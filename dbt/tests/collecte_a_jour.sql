-- Alerte si la collecte s'est arrêtée : RTE publie avec ~1 h de retard, au-delà de 4 h il y a un problème.
-- Ce test fait échouer le DAG Airflow, ce qui rend la panne visible.
select max(date_heure) as derniere_donnee
from {{ ref('stg_eco2mix') }}
having max(date_heure) < now() - interval 4 hour
