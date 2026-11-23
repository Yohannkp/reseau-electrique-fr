"""Collecte des données éCO2mix régionales (RTE, publiées sur ODRÉ), stockées brutes en Parquet.

Deux jeux de données :
- temps réel : un quart d'heure par région, glissant sur ~3 mois, collecté toutes les 15 min ;
- consolidé : l'historique définitif depuis 2013, rechargé par année.

Les fichiers bruts ne sont jamais modifiés : les doublons (recouvrements entre collectes,
temps réel puis consolidé) sont résolus dans dbt (modèle stg_eco2mix).
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import pathlib

import duckdb
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger(__name__)

API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/{}/exports/parquet"
TEMPS_REEL = "eco2mix-regional-tr"
CONSOLIDE = "eco2mix-regional-cons-def"
PREMIERE_ANNEE = 2013
# RTE complète et corrige les derniers quarts d'heure : on recollecte toujours les 6 dernières heures.
RECOUVREMENT = dt.timedelta(hours=6)


def dossier_brut() -> pathlib.Path:
    return pathlib.Path(os.environ.get("DATA_DIR", "data")) / "raw"


def _session() -> requests.Session:
    s = requests.Session()
    retry = Retry(total=5, backoff_factor=2, status_forcelist=(429, 500, 502, 503, 504))
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s


def telecharger(dataset: str, where: str, dest: pathlib.Path) -> int:
    """Télécharge un export Parquet filtré et l'écrit de façon atomique. Renvoie le nombre de lignes."""
    rep = _session().get(API.format(dataset), params={"where": where}, timeout=600)
    rep.raise_for_status()
    if rep.content[:4] != b"PAR1":
        raise ValueError(f"{dataset} : la réponse n'est pas un fichier Parquet ({rep.content[:80]!r})")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_bytes(rep.content)
    n = duckdb.sql("select count(*) from read_parquet(?)", params=[str(tmp)]).fetchall()[0][0]
    if n == 0:
        tmp.unlink()
        return 0
    tmp.replace(dest)  # un fichier à moitié écrit n'est jamais visible par dbt
    return n


def filtre_temps_reel(derniere: dt.datetime | None) -> str:
    where = "consommation is not null"  # l'API publie d'avance les quarts d'heure de la journée, vides
    if derniere is not None:
        depuis = (derniere - RECOUVREMENT).astimezone(dt.UTC)
        where += f" and date_heure >= '{depuis:%Y-%m-%dT%H:%M:%S}Z'"
    return where


def collecter_temps_reel(maintenant: dt.datetime | None = None) -> int:
    """Collecte incrémentale. Après une panne, rattrape tout seul tant que le trou tient dans la fenêtre de ~3 mois."""
    maintenant = maintenant or dt.datetime.now(dt.UTC)
    racine = dossier_brut() / "eco2mix_tr"
    etat_f = racine / "_etat.json"
    derniere = None
    if etat_f.exists():
        derniere = dt.datetime.fromisoformat(json.loads(etat_f.read_text())["derniere_date_heure"])

    dest = racine / f"date_collecte={maintenant:%Y-%m-%d}" / f"{maintenant:%H%M%S}.parquet"
    n = telecharger(TEMPS_REEL, filtre_temps_reel(derniere), dest)
    if n:
        maxi = duckdb.sql("select max(date_heure) from read_parquet(?)", params=[str(dest)]).fetchall()[0][0]
        etat_f.write_text(json.dumps({"derniere_date_heure": maxi.isoformat(), "collecte": maintenant.isoformat()}))
        log.info("temps réel : %s lignes, jusqu'à %s", n, maxi)
    else:
        log.warning("temps réel : aucune ligne nouvelle (filtre : %s)", filtre_temps_reel(derniere))
    return n


def collecter_consolide(aujourdhui: dt.date | None = None) -> int:
    """Charge l'historique consolidé par année. Les années closes déjà présentes ne sont pas retéléchargées ;
    l'année en cours et la précédente le sont, car RTE y ajoute les mois consolidés."""
    annee_courante = (aujourdhui or dt.date.today()).year
    total = 0
    for annee in range(PREMIERE_ANNEE - 1, annee_courante + 1):  # 2012 : le 1er janvier 2013 0 h Paris = 2012-12-31 23 h UTC
        dest = dossier_brut() / "eco2mix_def" / f"annee={annee}.parquet"
        if dest.exists() and annee < annee_courante - 1:
            continue
        where = f"date_heure >= '{annee}-01-01T00:00:00Z' and date_heure < '{annee + 1}-01-01T00:00:00Z'"
        n = telecharger(CONSOLIDE, where, dest)
        log.info("consolidé %s : %s lignes", annee, n)
        total += n
    return total
