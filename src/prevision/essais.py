"""Comparaison de variantes de modèle, jugées sur la période de réglage (2024) uniquement.
Le test (2025 →) n'est regardé qu'une fois la variante choisie : sinon on choisirait sur le test.
Usage : python -m prevision.essais
"""

import lightgbm as lgb
import numpy as np
import pandas as pd

from prevision.donnees import VARIABLES, construire, meteo_observee, national
from prevision.entrainement import DOSSIER, PARAMS, indicateurs, periode

REF = {"consommation_mw": "conso_veille_matin", "taux_co2_g_kwh": "co2_veille_matin"}


def variante(obs, cible, debut="2013-01-08", poids_recents=0.0, relative=False, sans_annee=False):
    app, reg = periode(obs, "apprentissage"), periode(obs, "reglage")
    app = app[(app["jour"] >= debut) & app[cible].notna() & app[REF[cible]].notna()]
    reg = reg[reg[cible].notna() & reg[REF[cible]].notna()]
    variables = [v for v in VARIABLES if not (sans_annee and v == "annee")]
    ref = REF[cible]
    y_app = app[cible] - app[ref] if relative else app[cible]
    y_reg = reg[cible] - reg[ref] if relative else reg[cible]
    poids = np.exp(poids_recents * (app["annee"] - app["annee"].max()))
    m = lgb.LGBMRegressor(n_estimators=6000, **(PARAMS | {"learning_rate": 0.1}))  # essais rapides, mêmes réglages pour tous
    m.fit(app[variables], y_app, sample_weight=poids, eval_set=[(reg[variables], y_reg)],
          callbacks=[lgb.early_stopping(200, verbose=False)])
    p = m.predict(reg[variables], num_iteration=m.best_iteration_)
    p = pd.Series(p + (reg[ref].values if relative else 0), index=reg.index)
    return {**indicateurs(reg[cible], p), "arbres": m.best_iteration_}


def main():
    obs = construire(national(DOSSIER), meteo_observee(DOSSIER))
    essais = {
        "base": {},
        "relative": {"relative": True},
        "relative_poids_0.3": {"relative": True, "poids_recents": 0.3},
        "poids_recents_0.3": {"poids_recents": 0.3},
        "relative_depuis_2019": {"relative": True, "debut": "2019-01-01"},
        "depuis_2019": {"debut": "2019-01-01"},
    }
    for cible in ("taux_co2_g_kwh", "consommation_mw"):
        print(f"\n{cible} (période de réglage 2024)", flush=True)
        for n, kw in essais.items():
            r = variante(obs, cible, **kw)
            print(f"{n:24s} erreur {r['erreur_pct']:6.2f} %  mae {r['mae']:9.2f}  biais {r['biais']:8.2f}  "
                  f"arbres {r['arbres']}", flush=True)


if __name__ == "__main__":
    main()
