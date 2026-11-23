"""Entraîne et évalue les modèles de prévision J+1 (consommation, CO2), et les enregistre dans MLflow.

Évaluation honnête, en trois périodes qui ne se recouvrent jamais :
- apprentissage : 2013 → 2023, météo observée ;
- réglage : 2024 (arrêt anticipé, et mesure du biais de RTE pour la référence corrigée) ;
- test : janvier 2025 → août 2026 (consommation consolidée) puis septembre 2026 → hier (temps réel),
  avec la météo telle qu'elle était prévue la veille.

Le modèle mis en production est ensuite réentraîné sur tout l'historique, avec le même nombre d'arbres.
Usage : python -m prevision.entrainement
"""

from __future__ import annotations

import logging
import os
import pathlib

import lightgbm as lgb
import mlflow
import numpy as np
import pandas as pd
from mlflow import MlflowClient

from prevision.donnees import VARIABLES, construire, meteo_nationale, meteo_observee, national, poids_regions

log = logging.getLogger(__name__)

DOSSIER = pathlib.Path(os.environ.get("DATA_DIR", "data")) / "export"
EXPERIENCE = "prevision_j1"
NOMS = {"consommation_mw": "conso_j1", "taux_co2_g_kwh": "co2_j1"}
PARAMS = {
    "objective": "regression_l1",  # robuste aux heures atypiques, et on juge en erreur absolue
    "learning_rate": 0.05, "num_leaves": 63, "min_child_samples": 50,
    "subsample": 0.8, "subsample_freq": 1, "colsample_bytree": 0.8, "verbose": -1,
}
# Variante retenue pour chaque cible, choisie sur la période de réglage (voir prevision/essais.py) :
# - relative : prévoir l'écart au niveau de la matinée de la veille plutôt que la valeur brute ;
# - poids_recents : poids exp(k × (année − dernière année)), pour suivre les changements de régime ;
# - debut : premier jour d'apprentissage.
# Réglage 2024 (erreur absolue moyenne) : conso relative 831 MW contre 865 en brut ;
# CO2 relatif depuis 2019 4,32 g/kWh contre 4,93 en brut et 5,80 pour la meilleure base naïve.
VARIANTES = {
    "consommation_mw": {"relative": True, "poids_recents": 0.0, "debut": "2013-01-08"},
    "taux_co2_g_kwh": {"relative": True, "poids_recents": 0.0, "debut": "2019-01-01"},
}
REF = {"consommation_mw": "conso_veille_matin", "taux_co2_g_kwh": "co2_veille_matin"}
PERIODES = {
    "apprentissage": ("2013-01-08", "2024-01-01"),
    "reglage": ("2024-01-01", "2025-01-01"),
    "test": ("2025-01-01", "2026-09-01"),
    "test_temps_reel": ("2026-09-01", None),
}


def indicateurs(y: pd.Series, p: pd.Series) -> dict:
    ok = y.notna() & p.notna()
    y, p = y[ok], p[ok]
    return {
        "erreur_pct": float(np.mean(np.abs(y - p) / np.abs(y)) * 100),
        "mae": float(np.mean(np.abs(y - p))),
        "biais": float(np.mean(y - p)),
        "n": int(ok.sum()),
    }


def periode(d: pd.DataFrame, nom: str) -> pd.DataFrame:
    debut, fin = PERIODES[nom]
    masque = d["jour"] >= debut
    if fin:
        masque &= d["jour"] < fin
    else:
        masque &= d["jour"] < pd.Timestamp.now().normalize()  # jours complets seulement
    return d[masque]


def meteo_prevue_veille() -> pd.DataFrame:
    import duckdb

    regionale = duckdb.connect().sql(f"""
        select code_insee_region, heure, temperature_c as temperature, rayonnement_w_m2 as rayonnement,
               vent_100m_km_h as vent
        from '{(DOSSIER / "meteo_prevue_veille.parquet").as_posix()}' where temperature_c is not null
    """).df()
    return meteo_nationale(regionale, poids_regions(DOSSIER))


def references(cible: str, d: pd.DataFrame, biais_rte: float) -> dict[str, pd.Series]:
    if cible == "consommation_mw":
        return {
            "naif_semaine_precedente": d["conso_j7"],
            "rte_veille": d["prevision_j1_mw"],
            "rte_veille_corrige": d["prevision_j1_mw"] + biais_rte,
        }
    return {"naif_semaine_precedente": d["co2_j7"], "naif_avant_veille": d["co2_j2"]}


def utilisable(d: pd.DataFrame, cible: str) -> pd.DataFrame:
    return d[d[cible].notna() & d[REF[cible]].notna()]


def apprendre(d: pd.DataFrame, cible: str, n_arbres: int, eval_set=None) -> lgb.LGBMRegressor:
    v = VARIANTES[cible]
    y = d[cible] - d[REF[cible]] if v["relative"] else d[cible]
    poids = np.exp(v["poids_recents"] * (d["annee"] - d["annee"].max()))
    m = lgb.LGBMRegressor(n_estimators=n_arbres, **PARAMS)
    if eval_set is None:
        return m.fit(d[VARIABLES], y, sample_weight=poids)
    e = eval_set
    y_e = e[cible] - e[REF[cible]] if v["relative"] else e[cible]
    return m.fit(d[VARIABLES], y, sample_weight=poids, eval_set=[(e[VARIABLES], y_e)],
                 callbacks=[lgb.early_stopping(200, verbose=False)])


def predire(modele, d: pd.DataFrame, cible: str, n_arbres=None) -> pd.Series:
    p = modele.predict(d[VARIABLES], num_iteration=n_arbres)
    if VARIANTES[cible]["relative"]:
        p = p + d[REF[cible]].to_numpy()
    return pd.Series(p, index=d.index)


def entrainer(cible: str, obs: pd.DataFrame, prevue: pd.DataFrame) -> dict:
    app = utilisable(periode(obs, "apprentissage"), cible)
    app = app[app["jour"] >= VARIANTES[cible]["debut"]]
    reg = utilisable(periode(obs, "reglage"), cible)
    modele = apprendre(app, cible, 10000, eval_set=reg)
    arbres = modele.best_iteration_

    biais_rte = float((reg["consommation_mw"] - reg["prevision_j1_mw"]).mean()) if cible == "consommation_mw" else 0.0
    resultats, lignes = {}, []
    for nom, source in (("reglage", obs), ("test", prevue), ("test_temps_reel", prevue)):
        e = periode(source, nom)
        e = utilisable(e, cible)
        e = e[e["temperature"].notna()]
        if e.empty:
            continue
        candidats = {"modele": predire(modele, e, cible, arbres)}
        candidats |= references(cible, e, biais_rte)
        for qui, p in candidats.items():
            m = indicateurs(e[cible], p)
            resultats[f"{nom}.{qui}"] = m
            lignes.append({"periode": nom, "prevision": qui, **m})

    # Modèle de production : tout l'historique observé, même nombre d'arbres.
    tout = utilisable(obs, cible)
    tout = tout[(tout["jour"] >= VARIANTES[cible]["debut"]) & (tout["jour"] < pd.Timestamp.now().normalize())]
    final = apprendre(tout, cible, arbres)
    return {"arbres": arbres, "biais_rte": biais_rte, "resultats": resultats,
            "tableau": pd.DataFrame(lignes), "modele": final, "exemple": tout[VARIABLES].tail(24)}


def enregistrer(cible: str, r: dict) -> None:
    nom = NOMS[cible]
    with mlflow.start_run(run_name=nom):
        mlflow.log_params({**PARAMS, **VARIANTES[cible], "cible": cible, "arbres": r["arbres"],
                           "biais_rte_2024": round(r["biais_rte"], 1)})
        for cle, m in r["resultats"].items():
            periode_, qui = cle.split(".")
            for k in ("erreur_pct", "mae", "biais"):
                mlflow.log_metric(f"{periode_}_{qui}_{k}", m[k])
        mlflow.log_text(r["tableau"].round(3).to_string(index=False), "comparaison.txt")
        imp = pd.Series(r["modele"].feature_importances_, index=VARIABLES).sort_values(ascending=False)
        mlflow.log_text(imp.to_string(), "importance_variables.txt")
        info = mlflow.lightgbm.log_model(r["modele"], name="modele", input_example=r["exemple"], registered_model_name=nom)
    client = MlflowClient()
    # l'API lit ce tag pour savoir s'il faut ajouter le niveau de la veille à la prédiction
    client.set_model_version_tag(nom, info.registered_model_version, "cible_relative", str(int(VARIANTES[cible]["relative"])))
    client.set_registered_model_alias(nom, "production", info.registered_model_version)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    mlflow.set_experiment(EXPERIENCE)
    nat = national(DOSSIER)
    obs = construire(nat, meteo_observee(DOSSIER))
    prevue = construire(nat, meteo_prevue_veille())
    for cible in NOMS:
        r = entrainer(cible, obs, prevue)
        log.info("%s : %s arbres\n%s", cible, r["arbres"], r["tableau"].round(3).to_string(index=False))
        enregistrer(cible, r)


if __name__ == "__main__":
    main()
