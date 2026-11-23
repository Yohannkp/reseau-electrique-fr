-- Météo par région et par heure, y compris les prochaines 48 h (prévision la plus récente).
-- Alimente l'API de prévision J+1, qui a besoin de la météo de demain.

select code_insee_region, heure, temperature_c, rayonnement_w_m2, vent_100m_km_h, source
from {{ ref('stg_meteo') }}
where heure >= now() - interval 30 day
