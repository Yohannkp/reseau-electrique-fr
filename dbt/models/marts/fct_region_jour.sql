-- Une ligne par région et par jour (heure de Paris). Granularité de référence pour la thermosensibilité :
-- la moyenne journalière efface le cycle jour/nuit et ne garde que l'effet de la température.

select
    code_insee_region,
    date_locale,
    avg(consommation_mw) as consommation_mw,
    avg(production_mw) as production_mw,
    avg(solde_mw) as solde_mw,
    avg(temperature_c) as temperature_c,
    count(*) as nb_heures
from {{ ref('fct_region_heure') }}
group by code_insee_region, date_locale
