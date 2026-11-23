"""Orchestration : collecte temps réel toutes les 15 min puis construction de l'entrepôt (dbt),
et rechargement hebdomadaire de l'historique consolidé."""

import pendulum
from airflow.sdk import dag, task

DEBUT = pendulum.datetime(2026, 11, 23, tz="UTC")
REPRISES = {"retries": 2, "retry_delay": pendulum.duration(minutes=3)}


@dag(schedule="*/15 * * * *", start_date=DEBUT, catchup=False, max_active_runs=1, default_args=REPRISES, tags=["eco2mix"])
def eco2mix_temps_reel():
    @task
    def collecte() -> int:
        from collecte.eco2mix import collecter_temps_reel

        return collecter_temps_reel()

    @task.bash
    def dbt_build() -> str:
        # Les tests dbt (doublons, valeurs absurdes, collecte en retard) font échouer la tâche : c'est l'alerte.
        return "/home/airflow/dbt/bin/dbt build --project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt"

    collecte() >> dbt_build()


@dag(schedule="@weekly", start_date=DEBUT, catchup=False, max_active_runs=1, default_args=REPRISES, tags=["eco2mix"])
def eco2mix_consolide():
    # Pas de dbt ici : le prochain passage du DAG temps réel reconstruit l'entrepôt (un seul écrivain DuckDB).
    @task
    def collecte() -> int:
        from collecte.eco2mix import collecter_consolide

        return collecter_consolide()

    collecte()


eco2mix_temps_reel()
eco2mix_consolide()
