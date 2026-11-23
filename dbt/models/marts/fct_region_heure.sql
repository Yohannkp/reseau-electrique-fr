-- Une ligne par région et par heure : consommation, production par filière, solde et météo.
-- Moyenne des pas de temps de l'heure (MW moyens), car le pas passe de 30 à 15 min selon les années.

with energie as (
    select
        code_insee_region,
        any_value(region) as region,
        date_trunc('hour', date_heure) as heure,
        avg(consommation_mw) as consommation_mw,
        avg(nucleaire_mw) as nucleaire_mw,
        avg(eolien_mw) as eolien_mw,
        avg(solaire_mw) as solaire_mw,
        avg(hydraulique_mw) as hydraulique_mw,
        avg(thermique_mw) as thermique_mw,
        avg(bioenergies_mw) as bioenergies_mw,
        count(*) as nb_pas
    from {{ ref('stg_eco2mix') }}
    group by code_insee_region, date_trunc('hour', date_heure)
)

select
    e.*,
    timezone('Europe/Paris', e.heure) as heure_locale,
    coalesce(e.nucleaire_mw, 0) + coalesce(e.eolien_mw, 0) + coalesce(e.solaire_mw, 0)
        + coalesce(e.hydraulique_mw, 0) + coalesce(e.thermique_mw, 0) + coalesce(e.bioenergies_mw, 0) as production_mw,
    production_mw - e.consommation_mw as solde_mw,  -- > 0 : la région exporte vers ses voisines
    m.temperature_c,
    m.rayonnement_w_m2,
    m.vent_100m_km_h
from energie as e
left join {{ ref('stg_meteo') }} as m
    on m.code_insee_region = e.code_insee_region and m.heure = e.heure
