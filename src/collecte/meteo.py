"""Météo horaire par région (Open-Meteo, CC BY 4.0), un point par région : sa préfecture.

- archive : réanalyse ERA5 depuis 2013, publiée avec ~5 jours de retard, chargée par année ;
- prévision : les 7 derniers jours et les 2 prochains, pour combler le retard de l'archive
  et fournir la température du lendemain au modèle de prévision.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import logging
import pathlib

import duckdb

from collecte.eco2mix import PREMIERE_ANNEE, _session, dossier_brut

log = logging.getLogger(__name__)

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
PREVISION = "https://api.open-meteo.com/v1/forecast"
VARIABLES = ["temperature_2m", "shortwave_radiation", "wind_speed_100m"]  # chauffage, solaire, éolien

# code INSEE de la région : (préfecture, latitude, longitude). Source unique : le seed dbt des régions.
with open(pathlib.Path(__file__).parents[2] / "dbt" / "seeds" / "regions.csv", encoding="utf-8") as f:
    REGIONS = {r["code_insee_region"]: (r["prefecture"], float(r["latitude"]), float(r["longitude"])) for r in csv.DictReader(f)}


def _requete(url: str, **params) -> list[dict]:
    codes = list(REGIONS)
    params |= {
        "latitude": ",".join(str(REGIONS[c][1]) for c in codes),
        "longitude": ",".join(str(REGIONS[c][2]) for c in codes),
        "hourly": ",".join(VARIABLES),
        "timezone": "UTC",
    }
    rep = _session().get(url, params=params, timeout=300)
    rep.raise_for_status()
    lieux = rep.json()
    if not isinstance(lieux, list) or len(lieux) != len(codes):  # l'API répond dans l'ordre des coordonnées
        raise ValueError(f"Open-Meteo : réponse inattendue ({str(lieux)[:200]})")
    return [{"code_insee_region": c, **lieu["hourly"]} for c, lieu in zip(codes, lieux, strict=True)]


def _ecrire(lignes: list[dict], dest) -> int:
    """Une ligne par région et par heure, en Parquet, écrit de façon atomique."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = dest.with_name(dest.name + ".json")
    tmp = dest.with_name(dest.name + ".tmp")
    src.write_text("\n".join(json.dumps(x) for x in lignes))
    colonnes = ", ".join(f"unnest({v}) as {v}" for v in VARIABLES)
    duckdb.sql(
        f"copy (select code_insee_region, cast(unnest(time) || 'Z' as timestamptz) as heure, {colonnes} "
        f"from read_json('{src.as_posix()}', format = 'newline_delimited')) to '{tmp.as_posix()}' (format parquet)"
    )
    src.unlink()
    n = duckdb.sql("select count(*) from read_parquet(?) where temperature_2m is not null", params=[str(tmp)]).fetchall()[0][0]
    if n == 0:
        tmp.unlink()
        return 0
    tmp.replace(dest)
    return n


def collecter_archive(aujourdhui: dt.date | None = None) -> int:
    aujourdhui = aujourdhui or dt.date.today()
    fin_archive = aujourdhui - dt.timedelta(days=6)
    total = 0
    for annee in range(PREMIERE_ANNEE - 1, fin_archive.year + 1):
        dest = dossier_brut() / "meteo_archive" / f"annee={annee}.parquet"
        if dest.exists() and annee < fin_archive.year:
            continue
        fin = min(dt.date(annee, 12, 31), fin_archive)
        n = _ecrire(_requete(ARCHIVE, start_date=f"{annee}-01-01", end_date=fin.isoformat()), dest)
        log.info("météo archive %s : %s lignes", annee, n)
        total += n
    return total


def collecter_prevision(maintenant: dt.datetime | None = None) -> int:
    maintenant = maintenant or dt.datetime.now(dt.UTC)
    dest = dossier_brut() / "meteo_prevision" / f"date_collecte={maintenant:%Y-%m-%d}" / f"{maintenant:%H%M%S}.parquet"
    n = _ecrire(_requete(PREVISION, past_days=7, forecast_days=2), dest)
    log.info("météo prévision : %s lignes", n)
    return n
