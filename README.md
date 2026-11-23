# Le réseau électrique français en temps réel

Pipeline de données de bout en bout sur la consommation et la production d'électricité des 12 régions
de France métropolitaine, quart d'heure par quart d'heure, depuis 2013 et en continu.

> Projet en cours. Fait : collecte, orchestration, entrepôt, tests de qualité.
> À venir : modèles d'analyse, tableau de bord, prévision de consommation (MLflow, FastAPI), carte 3D (Next.js, deck.gl).

## Architecture

```
API ODRÉ (RTE éCO2mix)
  ├─ temps réel, toutes les 15 min ─┐
  └─ consolidé 2013→, chaque semaine ┤  src/collecte  (reprises, écriture atomique, collecte incrémentale)
                                     ▼
                       data/raw/*.parquet   (brut, jamais modifié)
                                     ▼
                       dbt + DuckDB  →  stg_eco2mix   (typé, dédoublonné, testé)
                                     ▲
                Airflow 3 (LocalExecutor, PostgreSQL) orchestre le tout, dans Docker Compose
```

## Choix techniques

- **Collecte incrémentale avec recouvrement** : chaque passage recollecte les 6 dernières heures, car RTE
  complète les derniers quarts d'heure après coup. Les doublons sont résolus dans dbt (le consolidé l'emporte sur
  le temps réel, puis la collecte la plus récente).
- **Reprise après panne** : l'API temps réel garde environ 3 mois. Après une coupure, la collecte suivante rattrape
  le trou toute seule, à partir du dernier horodatage enregistré.
- **Écriture atomique** : un fichier n'apparaît qu'une fois complet et validé (format Parquet, au moins une ligne).
- **Types instables** : une même colonne peut arriver en nombre ou en texte selon l'export, donc tout est converti
  explicitement dans `stg_eco2mix`.
- **Tests de qualité** (dbt) : unicité région × quart d'heure, valeurs non nulles, consommation plausible,
  et une alerte si la donnée la plus récente a plus de 4 h. Un test qui échoue fait échouer le DAG.
  Ils ont déjà repéré une anomalie réelle dans les données de RTE : une consommation de 0 MW
  en Île-de-France le 23/08/2026 à 18 h.

## Démarrer

```bash
docker compose up -d --build        # Airflow sur http://localhost:18080
```

Sans Docker :

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
PYTHONPATH=src python -m collecte consolide     # historique depuis 2013 (~10 min, ~90 Mo)
PYTHONPATH=src python -m collecte temps-reel
cd dbt && dbt build --profiles-dir .
pytest
```

## Données

Données éCO2mix régionales de [RTE](https://www.rte-france.com/eco2mix), diffusées par
[ODRÉ](https://odre.opendatasoft.com) sous [Licence Ouverte v2.0 (Etalab)](https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf).
