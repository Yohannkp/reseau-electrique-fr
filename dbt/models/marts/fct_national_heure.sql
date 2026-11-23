-- Une ligne par heure pour la France : consommation, prévisions RTE et leur erreur, mix, CO2, température.

with national as (
    select
        date_trunc('hour', date_heure) as heure,
        avg(consommation_mw) as consommation_mw,
        avg(prevision_j1_mw) as prevision_j1_mw,
        avg(prevision_j_mw) as prevision_j_mw,
        avg(taux_co2_g_kwh) as taux_co2_g_kwh,
        avg(nucleaire_mw) as nucleaire_mw,
        avg(eolien_mw) as eolien_mw,
        avg(solaire_mw) as solaire_mw,
        avg(hydraulique_mw) as hydraulique_mw,
        avg(bioenergies_mw) as bioenergies_mw,
        avg(gaz_mw) as gaz_mw,
        avg(charbon_mw) as charbon_mw,
        avg(fioul_mw) as fioul_mw,
        avg(echanges_physiques_mw) as echanges_physiques_mw,
        max(source) as source  -- 'temps_reel' si au moins un pas de l'heure est provisoire
    from {{ ref('stg_eco2mix_national') }}
    group by date_trunc('hour', date_heure)
),

-- Température nationale : moyenne des régions pondérée par leur consommation de l'heure.
temperature as (
    select
        heure,
        sum(temperature_c * consommation_mw) / sum(consommation_mw) as temperature_ponderee_c,
        sum(consommation_mw) as consommation_regions_mw,
        count(*) as nb_regions  -- < 12 : heure encore incomplète (dernière heure) ou région manquante
    from {{ ref('fct_region_heure') }}
    where temperature_c is not null  -- shortcut: nb_regions compte les régions avec météo, égal tant que la météo couvre tout
    group by heure
)

select
    n.*,
    timezone('Europe/Paris', n.heure) as heure_locale,
    cast(heure_locale as date) as date_locale,
    hour(heure_locale) as heure_du_jour,
    n.consommation_mw - n.prevision_j1_mw as ecart_prevision_j1_mw,
    coalesce(n.nucleaire_mw, 0) + coalesce(n.eolien_mw, 0) + coalesce(n.solaire_mw, 0) + coalesce(n.hydraulique_mw, 0)
        + coalesce(n.bioenergies_mw, 0) + coalesce(n.gaz_mw, 0) + coalesce(n.charbon_mw, 0) + coalesce(n.fioul_mw, 0)
        as production_mw,
    (production_mw - coalesce(n.gaz_mw, 0) - coalesce(n.charbon_mw, 0) - coalesce(n.fioul_mw, 0))
        / nullif(production_mw, 0) as part_bas_carbone,  -- nucléaire + renouvelables, définition de RTE
    t.temperature_ponderee_c,
    t.consommation_regions_mw,
    t.nb_regions
from national as n
left join temperature as t on t.heure = n.heure
