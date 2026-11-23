-- Une ligne par région et par heure (UTC). L'archive ERA5 l'emporte ; à défaut (5 derniers jours et lendemain),
-- la prévision la plus récente. La colonne source permet au modèle de prévision de ne pas confondre observé et prévu.

with brut as (
    select *, 'archive' as source, 1 as priorite from {{ source('brut', 'meteo_archive') }}
    union all by name
    select *, 'prevision' as source, 2 as priorite from {{ source('brut', 'meteo_prevision') }}
)

select
    code_insee_region,
    cast(heure as timestamptz) as heure,
    temperature_2m as temperature_c,
    shortwave_radiation as rayonnement_w_m2,
    wind_speed_100m as vent_100m_km_h,
    source
from brut
where temperature_2m is not null
qualify row_number() over (partition by code_insee_region, heure order by priorite, filename desc) = 1
