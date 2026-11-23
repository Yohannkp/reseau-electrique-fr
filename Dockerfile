FROM apache/airflow:3.4.0

# La collecte tourne dans l'environnement d'Airflow ; dbt dans son propre environnement,
# pour ne pas entrer en conflit avec les dépendances d'Airflow. Même version de DuckDB des deux côtés
# (ils écrivent dans le même fichier d'entrepôt).
RUN pip install --no-cache-dir duckdb==2.0.1 \
 && python -m venv /home/airflow/dbt \
 && /home/airflow/dbt/bin/pip install --no-cache-dir duckdb==2.0.1 dbt-core==1.12.7 dbt-duckdb==1.11.1
