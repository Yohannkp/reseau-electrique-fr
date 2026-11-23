"""Orchestration.

- eco2mix_temps_reel (toutes les 15 min) : éCO2mix régional et national, puis construction de l'entrepôt (dbt) ;
- meteo_prevision (toutes les heures) : météo des 7 derniers jours et des 2 prochains ;
- historique (chaque semaine) : éCO2mix consolidé et archive météo. À lancer à la main au premier démarrage.

Seul le DAG temps réel lance dbt : DuckDB n'accepte qu'un écrivain à la fois.
"""

import pendulum
from airflow.sdk import dag, task

DEBUT = pendulum.datetime(2026, 11, 23, tz="UTC")
COMMUN = {
    "start_date": DEBUT,
    "catchup": False,
    "max_active_runs": 1,
    "default_args": {"retries": 2, "retry_delay": pendulum.duration(minutes=3)},
    "tags": ["eco2mix"],
}


@dag(schedule="*/15 * * * *", **COMMUN)
def eco2mix_temps_reel():
    @task
    def collecte(perimetre: str) -> int:
        from collecte.eco2mix import collecter_temps_reel

        return collecter_temps_reel(perimetre)

    @task.bash
    def dbt_build() -> str:
        # Les tests dbt (doublons, valeurs absurdes, collecte en retard) font échouer la tâche : c'est l'alerte.
        return "mkdir -p /opt/airflow/data/export && /home/airflow/dbt/bin/dbt build --project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt"

    collecte.expand(perimetre=["regional", "national"]) >> dbt_build()


@dag(schedule="5 * * * *", **COMMUN)
def meteo_prevision():
    @task
    def collecte() -> int:
        from collecte.meteo import collecter_prevision

        return collecter_prevision()

    collecte()


@dag(schedule="@weekly", **COMMUN)
def historique():
    @task
    def eco2mix_consolide(perimetre: str) -> int:
        from collecte.eco2mix import collecter_consolide

        return collecter_consolide(perimetre)

    @task
    def meteo_archive() -> int:
        from collecte.meteo import collecter_archive

        return collecter_archive()

    @task
    def meteo_prevue_veille() -> int:
        from collecte.meteo import collecter_prevision_veille

        return collecter_prevision_veille()

    eco2mix_consolide.expand(perimetre=["regional", "national"])
    meteo_archive()
    meteo_prevue_veille()



@dag(schedule="0 3 * * 1", **COMMUN)
def reentrainement():
    """Chaque lundi à 3 h : réentraîne les deux modèles, les enregistre dans MLflow (alias « production »)
    si tout s'est bien passé, puis demande à l'API de recharger les nouvelles versions."""

    @task.bash
    def entrainement() -> str:
        return "cd /opt/airflow && /home/airflow/ml/bin/python -m prevision.entrainement"

    @task.bash
    def recharger_api() -> str:
        return "curl -sf -X POST http://api:8000/recharger"

    entrainement() >> recharger_api()



# 2 h 07 UTC : entre deux passages de dbt (:00, :15…), qui ne lit donc jamais un fichier en cours de suppression.
@dag(schedule="7 2 * * *", **COMMUN)
def compactage():
    """Fusionne les petits fichiers des journées de collecte terminées (environ 200 par jour)."""

    @task
    def compacter() -> int:
        from collecte.compactage import compacter

        return compacter()

    compacter()


eco2mix_temps_reel()
meteo_prevision()
historique()
reentrainement()
compactage()
