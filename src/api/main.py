"""API de prévision J+1 : consommation et CO2 de la France heure par heure, et meilleur créneau bas carbone.

Les modèles viennent du registre MLflow (alias « production »), les données des fichiers Parquet écrits par dbt.
Lancement : uvicorn api.main:app --port 8000
"""

from __future__ import annotations

import datetime as dt
import os
import pathlib
from contextlib import asynccontextmanager
from typing import Annotated
from zoneinfo import ZoneInfo

import duckdb
import mlflow
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from mlflow import MlflowClient
from pydantic import BaseModel

from prevision.donnees import VARIABLES, construire, meteo_nationale, national, poids_regions

DOSSIER = pathlib.Path(os.environ.get("DATA_DIR", "data")) / "export"
PARIS = "Europe/Paris"
MODELES = {"consommation_mw": "conso_j1", "taux_co2_g_kwh": "co2_j1"}
REF = {"consommation_mw": "conso_veille_matin", "taux_co2_g_kwh": "co2_veille_matin"}
etat: dict = {}


def charger_modeles() -> None:
    client = MlflowClient()
    for cible, nom in MODELES.items():
        version = client.get_model_version_by_alias(nom, "production")
        etat[cible] = {
            "modele": mlflow.lightgbm.load_model(f"models:/{nom}@production"),
            "version": version.version,
            # cible relative : le modèle prévoit l'écart au niveau de la matinée de la veille
            "relative": version.tags.get("cible_relative") == "1",
        }


@asynccontextmanager
async def demarrage(app: FastAPI):
    try:
        charger_modeles()
    except Exception as e:  # noqa: BLE001 — serveur MLflow absent, modèle non enregistré... : l'API démarre et le dit dans /sante
        etat["erreur"] = str(e)
    yield


app = FastAPI(
    title="Réseau électrique français : prévision J+1",
    description="Consommation et intensité carbone de l'électricité en France pour demain, heure par heure, "
    "et meilleur créneau pour consommer bas carbone. Données RTE éCO2mix et Open-Meteo.",
    version="1.0.0",
    lifespan=demarrage,
)


class Heure(BaseModel):
    heure_locale: dt.datetime
    consommation_mw: float
    taux_co2_g_kwh: float


class Prevision(BaseModel):
    jour: dt.date
    versions_modeles: dict[str, str]
    donnees_completes: bool
    heures: list[Heure]


class Creneau(BaseModel):
    debut: dt.datetime
    fin: dt.datetime
    taux_co2_moyen_g_kwh: float
    pire_creneau_g_kwh: float
    economie_vs_pire_pct: float
    economie_vs_moyenne_pct: float


def meteo_recente() -> pd.DataFrame:
    regionale = duckdb.sql(f"""
        select code_insee_region, heure, temperature_c as temperature, rayonnement_w_m2 as rayonnement,
               vent_100m_km_h as vent
        from '{(DOSSIER / "meteo_region_heure.parquet").as_posix()}'
    """).df()
    return meteo_nationale(regionale, poids_regions(DOSSIER))


def variables_du_jour(jour: dt.date) -> pd.DataFrame:
    """Les 24 (ou 23/25) heures du jour J, avec les variables connues la veille."""
    nat = national(DOSSIER)
    nat = nat[pd.to_datetime(nat["heure_locale"]) >= pd.Timestamp(jour) - pd.Timedelta(days=10)]
    debut = pd.Timestamp(jour).tz_localize(PARIS)
    heures = pd.date_range(debut, debut + pd.Timedelta(days=1), freq="h", inclusive="left").tz_convert("UTC")
    a_prevoir = pd.DataFrame({"heure": heures, "heure_locale": heures.tz_convert(PARIS).tz_localize(None)})
    nat = nat[~pd.to_datetime(nat["heure"], utc=True).isin(heures)]  # on ne s'aide jamais du réel du jour J
    d = construire(pd.concat([nat, a_prevoir], ignore_index=True), meteo_recente())
    return d[d["jour"] == pd.Timestamp(jour)]


@app.post("/recharger")
def recharger():
    """Recharge les modèles « production » du registre (appelé par Airflow après un réentraînement)."""
    etat.pop("erreur", None)
    charger_modeles()
    return {c: etat[c]["version"] for c in MODELES}


@app.get("/sante")
def sante():
    fraicheur = duckdb.sql(
        f"select max(heure_locale) from '{(DOSSIER / 'fct_national_heure.parquet').as_posix()}'"
    ).fetchall()[0][0]
    return {
        "modeles": {c: etat[c]["version"] for c in MODELES if c in etat},
        "erreur": etat.get("erreur"),
        "derniere_donnee": fraicheur,
    }


@app.get("/prevision", response_model=Prevision)
def prevision(jour: Annotated[dt.date | None, Query(description="Jour à prévoir (défaut : demain, heure de Paris)")] = None):
    if "erreur" in etat:
        raise HTTPException(503, f"modèles indisponibles : {etat['erreur']}")
    jour = jour or dt.datetime.now(ZoneInfo(PARIS)).date() + dt.timedelta(days=1)
    d = variables_du_jour(jour)
    if d.empty or d["temperature"].isna().all():
        raise HTTPException(404, f"pas de météo disponible pour le {jour}")
    resultat = {}
    for cible, m in etat.items():
        if cible not in MODELES:
            continue
        p = m["modele"].predict(d[VARIABLES])
        resultat[cible] = p + d[REF[cible]].to_numpy() if m["relative"] else p
    return Prevision(
        jour=jour,
        versions_modeles={c: etat[c]["version"] for c in MODELES},
        donnees_completes=bool(d[["conso_veille_matin", "conso_j2", "temperature"]].notna().all().all()),
        heures=[
            Heure(heure_locale=h, consommation_mw=round(float(c), 0), taux_co2_g_kwh=round(float(co2), 1))
            for h, c, co2 in zip(d["heure_locale"], resultat["consommation_mw"], resultat["taux_co2_g_kwh"], strict=True)
        ],
    )


def meilleur_creneau(heures: list[Heure], duree_h: int) -> Creneau:
    co2 = pd.Series([h.taux_co2_g_kwh for h in heures])
    fenetres = co2.rolling(duree_h).mean().dropna()
    if fenetres.empty:
        raise HTTPException(422, "durée plus longue que la période prévue")
    fin = int(fenetres.idxmin())
    debut = fin - duree_h + 1
    meilleur, pire = float(fenetres.min()), float(fenetres.max())
    return Creneau(
        debut=heures[debut].heure_locale,
        fin=heures[fin].heure_locale + dt.timedelta(hours=1),
        taux_co2_moyen_g_kwh=round(meilleur, 1),
        pire_creneau_g_kwh=round(pire, 1),
        economie_vs_pire_pct=round((1 - meilleur / pire) * 100, 1),
        economie_vs_moyenne_pct=round((1 - meilleur / float(co2.mean())) * 100, 1),
    )


@app.get("/meilleur-creneau", response_model=Creneau)
def creneau(duree_h: Annotated[int, Query(ge=1, le=12, description="Durée de la consommation à placer (heures)")] = 3,
            jour: dt.date | None = None):
    """Le créneau de `duree_h` heures le moins carboné du jour prévu : recharge d'un véhicule, calcul lourd, lave-linge..."""
    return meilleur_creneau(prevision(jour).heures, duree_h)
