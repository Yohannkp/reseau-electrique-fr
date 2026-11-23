"""Publie les données de l'app 3D en fichiers JSON statiques, pour la version en ligne (GitHub Pages).

Le générateur appelle les mêmes fonctions que l'API FastAPI : la version en ligne affiche exactement ce que
l'API aurait répondu. Ce qui dépend d'un paramètre est précalculé pour chaque valeur possible : meilleur créneau
de 1 à 12 h, scénario de froid de -10 à +5 °C. Pour la carte, on publie les 14 derniers jours et les journées
remarquables (toute l'histoire depuis 2013 pèserait des centaines de Mo).

Usage : python -m publication.statique   (variables : SORTIE_STATIQUE, ETAPES="collecte:12.3,dbt:9.8,…")
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import pathlib

from api import carte
from api import main as api

log = logging.getLogger(__name__)

SORTIE = pathlib.Path(os.environ.get("SORTIE_STATIQUE", "web/public/data"))
JOURS_RECENTS = 14


def ecrire(nom: str, objet) -> None:
    chemin = SORTIE / nom
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(objet, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")


def etapes_orchestration() -> list[dict]:
    """Durées des étapes du workflow GitHub Actions, présentées comme les DAG dans le mode ingénieur."""
    maintenant = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    etapes = []
    for morceau in filter(None, os.environ.get("ETAPES", "").split(",")):
        nom, duree = morceau.split(":")
        etapes.append({"dag": nom, "derniere_execution": maintenant, "etat": "success", "duree_s": float(duree)})
    return etapes


def publier() -> int:
    api.charger_modeles()
    periode = carte.periode()
    journees = carte.journees()
    fin = dt.date.fromisoformat(str(periode["fin"]))
    jours = sorted({fin - dt.timedelta(days=k) for k in range(JOURS_RECENTS)} | {dt.date.fromisoformat(j["date"]) for j in journees})
    for jour in jours:
        ecrire(f"regions/{jour}.json", carte.carte_regions(debut=jour, jours=1))
        ecrire(f"national/{jour}.json", carte.carte_national(debut=jour, jours=1))
    ecrire("periode.json", {**periode, "jours": [str(j) for j in jours]})
    ecrire("journees.json", journees)

    prevision = api.prevision(None)
    ecrire("prevision.json", prevision.model_dump(mode="json"))
    ecrire("creneaux.json", {str(h): api.meilleur_creneau(prevision.heures, h).model_dump(mode="json") for h in range(1, 13)})
    ecrire("scenarios.json", {str(d): api.scenario_froid(delta_c=d, jour=None) for d in range(-10, 6)})

    etat = carte.pipeline()
    etat["airflow"] = etapes_orchestration()  # pas d'Airflow en ligne : les étapes du workflow en tiennent lieu
    etat["orchestrateur"] = "GitHub Actions, chaque heure"
    ecrire("pipeline.json", etat)
    log.info("%s jours publiés dans %s", len(jours), SORTIE)
    return len(jours)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    publier()
