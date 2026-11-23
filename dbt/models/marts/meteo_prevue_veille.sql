-- Météo du jour J telle que prévue la veille, par région et par heure (UTC).
-- Utilisée pour tester le modèle de prévision dans les conditions réelles : la météo observée n'est connue qu'après coup.

select
    code_insee_region,
    cast(heure as timestamptz) as heure,
    temperature_2m as temperature_c,
    shortwave_radiation as rayonnement_w_m2,
    wind_speed_100m as vent_100m_km_h
from {{ source('brut', 'meteo_prevision_veille') }}
where temperature_2m is not null
qualify row_number() over (partition by code_insee_region, heure order by filename desc) = 1
