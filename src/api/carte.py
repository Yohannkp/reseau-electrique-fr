"""Endpoints de l'app 3D : cartes régionales, courbes nationales, journées remarquables et état du pipeline.

Toutes les heures sont en heure locale de Paris, au format ISO sans fuseau (« 2026-11-23T14:00:00 »).
"""

from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import time
from typing import Annotated
from zoneinfo import ZoneInfo

import duckdb
import pandas as pd
import requests
from fastapi import APIRouter, Query
from mlflow import MlflowClient

DOSSIER = pathlib.Path(os.environ.get("DATA_DIR", "data")) / "export"
PARIS = "Europe/Paris"
DBT_TARGET = pathlib.Path(os.environ.get("DBT_TARGET", "dbt/target"))
AIRFLOW_URL = os.environ.get("AIRFLOW_URL", "http://localhost:18080")
DAGS = ["eco2mix_temps_reel", "meteo_prevision", "historique", "reentrainement"]
router = APIRouter()
_cache: dict = {}


def parquet(table: str) -> str:
    return (DOSSIER / f"{table}.parquet").as_posix()


def cache_60s(f):
    """Mémorise le résultat 60 s : Airflow, MLflow et le calcul des records n'ont pas à être interrogés à chaque appel."""
    def enveloppe():
        t, valeur = _cache.get(f.__name__, (0.0, None))
        if time.monotonic() - t > 60:
            valeur = f()
            _cache[f.__name__] = (time.monotonic(), valeur)
        return valeur
    return enveloppe


def liste(serie: pd.Series, decimales: int = 0) -> list:
    """Valeurs JSON : arrondies, null à la place des trous."""
    return [None if pd.isna(v) else (round(float(v), decimales) if decimales else round(float(v))) for v in serie]


def iso(heures) -> list[str]:
    return [pd.Timestamp(h).isoformat() for h in heures]


def fenetre(debut: dt.date | None, jours: int) -> tuple[dt.date, dt.date]:
    """[debut, fin[ ; sans `debut`, les `jours` derniers jours disponibles."""
    if debut is None:
        derniere = duckdb.connect().sql(f"select max(date_locale) from '{parquet('fct_region_heure')}'").fetchall()[0][0]
        debut = derniere - dt.timedelta(days=jours - 1)
    return debut, debut + dt.timedelta(days=jours)


@router.get("/periode")
def periode():
    """Premier et dernier jour disponibles dans fct_region_heure."""
    premier, dernier = duckdb.connect().sql(f"select min(date_locale), max(date_locale) from '{parquet('fct_region_heure')}'").fetchall()[0]
    return {"debut": premier.isoformat(), "fin": dernier.isoformat()}


@router.get("/carte/regions")
def carte_regions(debut: dt.date | None = None, jours: Annotated[int, Query(ge=1, le=31)] = 1):
    """Une série horaire par région et par grandeur (MW, °C), alignée sur `heures`."""
    debut, fin = fenetre(debut, jours)
    d = duckdb.connect().sql(f"""
        select code_insee_region as code, heure, heure_locale, consommation_mw, production_mw, solde_mw,
               temperature_c as temperature, nucleaire_mw as nucleaire, eolien_mw as eolien, solaire_mw as solaire,
               hydraulique_mw as hydraulique, thermique_mw as thermique, bioenergies_mw as bioenergies
        from '{parquet('fct_region_heure')}' where date_locale >= '{debut}' and date_locale < '{fin}'
    """).df()
    regions = duckdb.connect().sql(f"select code_insee_region as code, region as nom, latitude, longitude from '{parquet('dim_region')}' order by 1").df()
    heures = d.drop_duplicates("heure").sort_values("heure").set_index("heure")["heure_locale"]
    noms = {"consommation_mw": "consommation_mw", "production_mw": "production_mw", "solde_mw": "solde_mw",
            "temperature_c": "temperature", "nucleaire_mw": "nucleaire", "eolien_mw": "eolien", "solaire_mw": "solaire",
            "hydraulique_mw": "hydraulique", "thermique_mw": "thermique", "bioenergies_mw": "bioenergies"}
    valeurs = {}
    for code, g in d.groupby("code"):
        g = g.set_index("heure").reindex(heures.index)
        valeurs[code] = {sortie: liste(g[col], 1 if sortie == "temperature_c" else 0) for sortie, col in noms.items()}
    return {"heures": iso(heures), "regions": regions.to_dict("records"), "valeurs": valeurs}


# Convention RTE : négatif = la France exporte. Convention de sortie de l'API : positif = la France exporte.
FRONTIERES = ["angleterre", "espagne", "italie", "suisse", "allemagne_belgique"]
FILIERES = ["nucleaire", "hydraulique", "eolien", "solaire", "bioenergies", "gaz", "charbon", "fioul"]


def export_depuis_rte(serie: pd.Series) -> pd.Series:
    return -serie


@router.get("/carte/national")
def carte_national(debut: dt.date | None = None, jours: Annotated[int, Query(ge=1, le=31)] = 1):
    """Courbes nationales horaires. `echanges` : MW par frontière, positif quand la France EXPORTE
    (RTE publie l'inverse : négatif = export, vérifié sur 2024-2025 où la France est très majoritairement exportatrice)."""
    debut, fin = fenetre(debut, jours)
    colonnes = ", ".join(f"{f}_mw" for f in FILIERES) + ", " + ", ".join(f"ech_comm_{f}_mw" for f in FRONTIERES)
    d = duckdb.connect().sql(f"""
        select heure_locale, consommation_mw, prevision_j1_mw, taux_co2_g_kwh, part_bas_carbone, {colonnes}
        from '{parquet('fct_national_heure')}' where date_locale >= '{debut}' and date_locale < '{fin}' order by heure
    """).df()
    return {
        "heures": iso(d["heure_locale"]),
        "consommation_mw": liste(d["consommation_mw"]),
        "prevision_j1_mw": liste(d["prevision_j1_mw"]),
        "taux_co2_g_kwh": liste(d["taux_co2_g_kwh"]),
        "part_bas_carbone": liste(d["part_bas_carbone"], 3),
        "mix": {f: liste(d[f"{f}_mw"]) for f in FILIERES},
        "echanges": {f: liste(export_depuis_rte(d[f"ech_comm_{f}_mw"])) for f in FRONTIERES},
    }


def gw(mw: float) -> str:
    return f"{mw / 1000:.1f}".replace(".", ",") + " GW"


def jour_fr(jour: dt.date) -> str:
    return jour.strftime("%d/%m/%Y")


def journees_remarquables(h: pd.DataFrame) -> list[dict]:
    """Records tirés des données horaires nationales (colonnes de fct_national_heure)."""
    h = h.assign(date=pd.to_datetime(h["heure_locale"]).dt.normalize())
    res = []

    def record(serie: pd.Series, plus_grand: bool, titre: str, description: str, valeur) -> None:
        if serie.notna().any():
            i = serie.idxmax() if plus_grand else serie.idxmin()
            jour = h.loc[i, "date"].date()
            res.append({"date": jour.isoformat(), "titre": titre, "valeur": valeur(serie[i]),
                        "description": description.format(jour=jour_fr(jour), heure=pd.Timestamp(h.loc[i, "heure_locale"]).hour)})

    record(h["consommation_mw"], True, "Pointe de consommation", "Record de consommation horaire, le {jour} à {heure} h.", gw)
    record(h["consommation_mw"], False, "Consommation la plus basse", "Plus bas niveau de consommation horaire, le {jour} à {heure} h.", gw)
    record(h["solaire_mw"], True, "Record solaire", "Production solaire maximale, le {jour} à {heure} h.", gw)
    record(h["eolien_mw"], True, "Record éolien", "Production éolienne maximale, le {jour} à {heure} h.", gw)
    record(h["echanges_physiques_mw"], False, "Record d'export", "Plus forte exportation d'électricité, le {jour} à {heure} h.", lambda v: gw(-v))
    record(h["echanges_physiques_mw"], True, "Record d'import", "Plus forte importation d'électricité, le {jour} à {heure} h.", gw)

    # CO2 : moyenne journalière, sur les jours complets seulement
    co2 = h.groupby("date")["taux_co2_g_kwh"].agg(["mean", "count"])
    co2 = co2[co2["count"] >= 20]["mean"]
    recent = co2[co2.index >= co2.index.max() - pd.DateOffset(years=3)]
    for serie, plus_grand, titre, desc in [
        (recent, True, "Journée la plus carbonée", "Électricité la plus carbonée des 3 dernières années, le {jour}."),
        (co2, False, "Journée la plus propre", "Électricité la moins carbonée de l'historique, le {jour}."),
    ]:
        if not serie.empty:
            jour = (serie.idxmax() if plus_grand else serie.idxmin()).date()
            res.append({"date": jour.isoformat(), "titre": titre, "description": desc.format(jour=jour_fr(jour)),
                        "valeur": f"{serie.max() if plus_grand else serie.min():.0f} g/kWh"})
    return res


@cache_60s
def calculer_journees() -> list[dict]:
    h = duckdb.connect().sql(f"""
        select heure_locale, consommation_mw, solaire_mw, eolien_mw, taux_co2_g_kwh, echanges_physiques_mw
        from '{parquet('fct_national_heure')}'
        where date_locale >= (select min(date_locale) from '{parquet('fct_region_heure')}')
    """).df()  # même période que la carte régionale : chaque journée citée est affichable
    return journees_remarquables(h)


@router.get("/journees-remarquables")
def journees():
    """Records de l'historique, calculés à chaque appel sur fct_national_heure (mis en cache 60 s)."""
    return calculer_journees()


def lire_run_results(dossier: pathlib.Path) -> dict:
    """Résumé du dernier `dbt build` à partir de run_results.json (tout à zéro si le fichier manque)."""
    vide = {"date": None, "duree_s": None, "tests": 0, "reussis": 0, "avertissements": 0, "echecs": 0, "resultats": []}
    try:
        brut = json.loads((dossier / "run_results.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return vide
    resultats = [{"nom": r["unique_id"].split(".")[2], "statut": r["status"], "duree_s": round(r["execution_time"], 2)}
                 for r in brut["results"]]
    tests = [r for r, b in zip(resultats, brut["results"], strict=True) if b["unique_id"].startswith("test.")]
    return {
        "date": brut["metadata"]["generated_at"], "duree_s": round(brut.get("elapsed_time", 0.0), 1), "tests": len(tests),
        "reussis": sum(t["statut"] == "pass" for t in tests), "avertissements": sum(t["statut"] == "warn" for t in tests),
        "echecs": sum(t["statut"] in ("fail", "error") for t in tests), "resultats": resultats,
    }


@cache_60s
def etat_airflow() -> list[dict]:
    """Dernière exécution de chaque DAG ; liste vide si Airflow est injoignable."""
    try:
        # SimpleAuthManager en mode « tous admins » : un GET suffit pour obtenir un jeton.
        jeton = requests.get(f"{AIRFLOW_URL}/auth/token", timeout=3).json()["access_token"]
        sortie = []
        for dag in DAGS:
            r = requests.get(f"{AIRFLOW_URL}/api/v2/dags/{dag}/dagRuns", params={"order_by": "-start_date", "limit": 1},
                             headers={"Authorization": f"Bearer {jeton}"}, timeout=3)
            runs = r.json().get("dag_runs", []) if r.ok else []
            run = runs[0] if runs else {}
            sortie.append({"dag": dag, "derniere_execution": run.get("start_date"), "etat": run.get("state"),
                           "duree_s": round(run["duration"], 1) if run.get("duration") is not None else None})
        return sortie
    except (requests.RequestException, KeyError, ValueError):
        return []


@cache_60s
def etat_modeles() -> list[dict]:
    """Version « production » et erreur sur le jeu de test de chaque modèle ; liste vide si MLflow est injoignable."""
    sortie = []
    try:
        client = MlflowClient()
        for nom, metrique, unite in [("conso_j1", "test_modele_erreur_pct", "%"), ("co2_j1", "test_modele_mae", "g/kWh")]:
            v = client.get_model_version_by_alias(nom, "production")
            valeur = client.get_run(v.run_id).data.metrics[metrique]
            sortie.append({"nom": nom, "version": v.version, "erreur_test": f"{valeur:.1f} {unite}"})
    except Exception:  # noqa: BLE001 — MLflow absent ou modèle non enregistré : la page pipeline s'affiche quand même
        return sortie
    return sortie


@router.get("/pipeline")
def pipeline():
    """État du pipeline : fraîcheur des sources, volumes, dernier dbt build, DAG Airflow, modèles en production."""
    maintenant = dt.datetime.now(ZoneInfo(PARIS)).replace(tzinfo=None)
    fraicheur = []
    for nom, table in [("éCO2mix régional", "fct_region_heure"), ("éCO2mix national", "fct_national_heure"),
                       ("Météo (observée)", "meteo_region_heure")]:
        # la météo contient aussi 2 jours de prévision : on ne compte que le passé
        derniere = duckdb.connect().sql(f"select max(h) from (select timezone('{PARIS}', heure)::timestamp as h from '{parquet(table)}') "
                              f"where h <= '{maintenant}'").fetchall()[0][0]
        fraicheur.append({"source": nom, "derniere_donnee": derniere.isoformat(),
                          "retard_min": int((maintenant - derniere).total_seconds() // 60)})
    volumes = [{"table": p.stem, "lignes": duckdb.connect().sql(f"select count(*) from '{p.as_posix()}'").fetchall()[0][0]}
               for p in sorted(DOSSIER.glob("*.parquet"))]
    return {"genere_a": maintenant.isoformat(timespec="seconds"), "fraicheur": fraicheur, "volumes": volumes,
            "dbt": lire_run_results(DBT_TARGET), "airflow": etat_airflow(), "modeles": etat_modeles()}
