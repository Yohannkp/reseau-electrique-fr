"""Compactage quotidien des collectes fréquentes.

Le temps réel (toutes les 15 min) et la météo (toutes les heures) écrivent chacun un petit fichier par passage :
environ 200 par jour, 70 000 par an. dbt devrait tous les ouvrir à chaque passage. Chaque nuit, les fichiers d'une
journée de collecte terminée sont fusionnés en un seul, `journee.parquet`, qui ne garde que la dernière version
collectée de chaque quart d'heure (ou heure) : c'est exactement ce que dbt aurait retenu.

Sûreté : le fichier fusionné est écrit de façon atomique AVANT la suppression des originaux. Si le processus s'arrête
entre les deux, les doublons restants sont identiques et dbt les résout ; le passage suivant termine le travail.
"""

from __future__ import annotations

import datetime as dt
import logging
import pathlib

import duckdb

from collecte.eco2mix import dossier_brut

log = logging.getLogger(__name__)

# dossier brut : clé d'unicité d'une mesure
DOSSIERS = {
    "eco2mix_tr": ["code_insee_region", "date_heure"],
    "eco2mix_national_tr": ["date_heure"],
    "meteo_prevision": ["code_insee_region", "heure"],
}
FUSION = "journee.parquet"  # après « HHMMSS.parquet » dans l'ordre des noms : reste la version la plus récente


def compacter_jour(dossier_jour: pathlib.Path, cle: list[str]) -> int:
    """Fusionne les fichiers d'un dossier `date_collecte=…`. Renvoie le nombre de fichiers retirés."""
    fichiers = sorted(dossier_jour.glob("*.parquet"))
    if len(fichiers) <= 1:
        return 0
    tmp = dossier_jour / (FUSION + ".tmp")
    liste = ", ".join(f"'{f.as_posix()}'" for f in fichiers)
    # les noms se trient dans l'ordre de collecte (HHMMSS, puis journee) : le plus grand est le plus récent
    duckdb.connect().sql(f"""
        copy (
            select * exclude (filename)
            from read_parquet([{liste}], filename = true, union_by_name = true)
            qualify row_number() over (partition by {", ".join(cle)} order by filename desc) = 1
        ) to '{tmp.as_posix()}' (format parquet)
    """)
    tmp.replace(dossier_jour / FUSION)
    retires = 0
    for f in fichiers:
        if f.name != FUSION:
            f.unlink()
            retires += 1
    return retires


def compacter(aujourdhui: dt.date | None = None) -> int:
    """Compacte toutes les journées de collecte terminées (strictement avant aujourd'hui, UTC)."""
    aujourdhui = aujourdhui or dt.datetime.now(dt.UTC).date()
    total = 0
    for nom, cle in DOSSIERS.items():
        for dossier_jour in sorted((dossier_brut() / nom).glob("date_collecte=*")):
            jour = dt.date.fromisoformat(dossier_jour.name.split("=")[1])
            if jour < aujourdhui:
                n = compacter_jour(dossier_jour, cle)
                if n:
                    log.info("%s %s : %s fichiers fusionnés", nom, jour, n)
                total += n
    return total
