FROM apache/airflow:3.4.0

# LightGBM a besoin d'OpenMP, absent de l'image Airflow.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
USER airflow

# La collecte tourne dans l'environnement d'Airflow ; dbt et la prévision dans leurs propres environnements,
# pour ne pas entrer en conflit avec les dépendances d'Airflow. Même version de DuckDB partout
# (tous écrivent ou lisent le même fichier d'entrepôt).
COPY requirements-ml.txt /tmp/requirements-ml.txt
RUN pip install --no-cache-dir duckdb==2.0.1 \
 && python -m venv /home/airflow/dbt \
 && /home/airflow/dbt/bin/pip install --no-cache-dir duckdb==2.0.1 dbt-core==1.12.7 dbt-duckdb==1.11.1 \
 && python -m venv /home/airflow/ml \
 && /home/airflow/ml/bin/pip install --no-cache-dir -r /tmp/requirements-ml.txt
