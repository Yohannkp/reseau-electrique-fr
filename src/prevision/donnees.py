"""Jeu de données de la prévision J+1 : consommation nationale et taux de CO2, heure par heure.

Règle d'or : la prévision du jour J est émise la veille (J-1) à midi, heure de Paris. Chaque variable
n'utilise que ce qui était connu à ce moment-là :
- consommation et CO2 observés jusqu'à J-1 11 h (moyenne de la matinée de la veille, même heure J-2 et J-7) ;
- calendrier (jours fériés, ponts) ;
- météo du jour J : la prévision de la veille quand on l'a, sinon l'observation (voir `meteo_nationale`).
"""

from __future__ import annotations

import pathlib

import duckdb
import holidays
import numpy as np
import pandas as pd

CIBLES = ["consommation_mw", "taux_co2_g_kwh"]
VARIABLES = [
    "heure", "jour_semaine", "jour_annee_sin", "jour_annee_cos", "ferie", "pont", "fetes_fin_annee", "annee",
    "temperature", "temperature_moy_jour", "temperature_moy_j2", "rayonnement", "vent",
    "conso_j2", "conso_j7", "conso_veille_matin", "co2_j2", "co2_j7", "co2_veille_matin",
]


def _export(dossier: pathlib.Path, table: str) -> str:
    return (dossier / f"{table}.parquet").as_posix()


def poids_regions(dossier: pathlib.Path) -> pd.DataFrame:
    """Poids de chaque région dans la consommation nationale (moyenne sur tout l'historique).
    Poids fixes : le même calcul vaut pour la météo observée et pour la météo prévue."""
    return duckdb.connect().sql(f"""
        select code_insee_region, avg(consommation_mw) / sum(avg(consommation_mw)) over () as poids
        from '{_export(dossier, 'fct_region_jour')}' group by 1
    """).df()


def meteo_nationale(regionale: pd.DataFrame, poids: pd.DataFrame) -> pd.DataFrame:
    """Météo horaire nationale à partir de colonnes régionales (code_insee_region, heure, temperature,
    rayonnement, vent) : moyenne pondérée par la consommation des régions."""
    m = regionale.merge(poids, on="code_insee_region")
    for c in ("temperature", "rayonnement", "vent"):
        m[c] = m[c] * m["poids"]
    g = m.groupby("heure")[["temperature", "rayonnement", "vent", "poids"]].sum()
    g = g[g["poids"] > 0.99]  # heures où toutes les régions sont présentes
    return g[["temperature", "rayonnement", "vent"]].div(g["poids"], axis=0).reset_index()


def meteo_observee(dossier: pathlib.Path) -> pd.DataFrame:
    regionale = duckdb.connect().sql(f"""
        select code_insee_region, heure, temperature_c as temperature, rayonnement_w_m2 as rayonnement,
               vent_100m_km_h as vent
        from '{_export(dossier, 'fct_region_heure')}' where temperature_c is not null
    """).df()
    return meteo_nationale(regionale, poids_regions(dossier))


def national(dossier: pathlib.Path) -> pd.DataFrame:
    return duckdb.connect().sql(f"""
        select heure, heure_locale, consommation_mw, taux_co2_g_kwh, prevision_j1_mw, source
        from '{_export(dossier, 'fct_national_heure')}'
    """).df()


def construire(nat: pd.DataFrame, meteo: pd.DataFrame) -> pd.DataFrame:
    """Une ligne par heure du jour J, avec les variables connues la veille à midi et les cibles."""
    d = nat.copy()
    d["heure"] = pd.to_datetime(d["heure"], utc=True)
    loc = pd.to_datetime(d["heure_locale"])
    d["jour"] = loc.dt.normalize()
    d["h"] = loc.dt.hour

    # Retards en temps réel écoulé (UTC) : J-2 et J-7 à la même heure sont toujours connus la veille à midi.
    serie = d.set_index("heure")[["consommation_mw", "taux_co2_g_kwh"]]
    for suffixe, decalage in (("j2", "48h"), ("j7", "168h")):
        r = serie.copy()
        r.index = r.index + pd.Timedelta(decalage)
        r.columns = [f"conso_{suffixe}", f"co2_{suffixe}"]
        d = d.merge(r, left_on="heure", right_index=True, how="left")

    # Moyenne de la matinée de la veille (0 h - 11 h, heure de Paris) : le dernier niveau observé.
    matin = d[d["h"] < 12].groupby("jour")[["consommation_mw", "taux_co2_g_kwh"]].mean()
    matin.index = matin.index + pd.Timedelta(days=1)
    matin.columns = ["conso_veille_matin", "co2_veille_matin"]
    d = d.merge(matin, left_on="jour", right_index=True, how="left")

    # Météo du jour J (prévue ou observée selon `meteo`), et moyenne observée de J-2 pour l'inertie des bâtiments.
    met = meteo.copy()
    met["heure"] = pd.to_datetime(met["heure"], utc=True)
    d = d.merge(met, on="heure", how="left")
    d["temperature_moy_jour"] = d.groupby("jour")["temperature"].transform("mean")
    moy = d.groupby("jour")["temperature"].mean()
    moy.index = moy.index + pd.Timedelta(days=2)
    d = d.merge(moy.rename("temperature_moy_j2"), left_on="jour", right_index=True, how="left")

    # Calendrier
    feries = holidays.France(years=range(d["jour"].dt.year.min(), d["jour"].dt.year.max() + 2))
    jours = d["jour"].dt.date
    d["ferie"] = jours.map(lambda j: j in feries).astype(int)
    veille_ferie = (d["jour"] + pd.Timedelta(days=1)).dt.date.map(lambda j: j in feries)
    lendemain_ferie = (d["jour"] - pd.Timedelta(days=1)).dt.date.map(lambda j: j in feries)
    d["pont"] = (((d["jour"].dt.day_of_week == 0) & veille_ferie) | ((d["jour"].dt.day_of_week == 4) & lendemain_ferie)).astype(int)
    d["fetes_fin_annee"] = (((d["jour"].dt.month == 12) & (d["jour"].dt.day >= 24)) | ((d["jour"].dt.month == 1) & (d["jour"].dt.day <= 1))).astype(int)
    d["jour_semaine"] = d["jour"].dt.day_of_week
    angle = 2 * np.pi * d["jour"].dt.day_of_year / 365.25
    d["jour_annee_sin"], d["jour_annee_cos"] = np.sin(angle), np.cos(angle)
    d["annee"] = d["jour"].dt.year
    return d.rename(columns={"heure": "heure_utc", "h": "heure"})
