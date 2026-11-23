-- Bornes physiques larges : une valeur hors de ces bornes est une erreur de donnée, pas un record.
select 'taux_co2' as controle, cast(heure as varchar) as cle
from {{ ref('fct_national_heure') }}
where taux_co2_g_kwh < 0 or taux_co2_g_kwh > 300

union all
select 'consommation_nationale', cast(heure as varchar)
from {{ ref('fct_national_heure') }}
where consommation_mw < 20000 or consommation_mw > 110000  -- record historique ~102 GW (février 2012)

union all
select 'temperature', code_insee_region || '|' || cast(heure as varchar)
from {{ ref('stg_meteo') }}
where temperature_c < -30 or temperature_c > 50
