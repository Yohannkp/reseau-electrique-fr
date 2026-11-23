-- Une ligne par quart d'heure (demi-heure avant 2023 environ) pour la France métropolitaine hors Corse.
-- Mêmes règles que stg_eco2mix : le consolidé l'emporte, puis la collecte la plus récente.

with brut as (
    select *, 'consolide' as source, 1 as priorite from {{ source('brut', 'eco2mix_national_def') }}
    union all by name
    select *, 'temps_reel' as source, 2 as priorite from {{ source('brut', 'eco2mix_national_tr') }}
)

select
    cast(date_heure as timestamptz) as date_heure,
    try_cast(consommation as integer) as consommation_mw,
    try_cast(prevision_j1 as integer) as prevision_j1_mw,
    try_cast(prevision_j as integer) as prevision_j_mw,
    try_cast(taux_co2 as integer) as taux_co2_g_kwh,
    try_cast(nucleaire as integer) as nucleaire_mw,
    try_cast(eolien as integer) as eolien_mw,
    try_cast(solaire as integer) as solaire_mw,
    try_cast(hydraulique as integer) as hydraulique_mw,
    try_cast(bioenergies as integer) as bioenergies_mw,
    try_cast(gaz as integer) as gaz_mw,
    try_cast(charbon as integer) as charbon_mw,
    try_cast(fioul as integer) as fioul_mw,
    try_cast(pompage as integer) as pompage_mw,
    try_cast(ech_physiques as integer) as echanges_physiques_mw,
    -- échanges commerciaux par frontière : négatif = la France exporte (vérifié : exportatrice en 2024-2025)
    try_cast(ech_comm_angleterre as integer) as ech_comm_angleterre_mw,
    try_cast(ech_comm_espagne as integer) as ech_comm_espagne_mw,
    try_cast(ech_comm_italie as integer) as ech_comm_italie_mw,
    try_cast(ech_comm_suisse as integer) as ech_comm_suisse_mw,
    try_cast(ech_comm_allemagne_belgique as integer) as ech_comm_allemagne_belgique_mw,
    source
from brut
where try_cast(consommation as integer) > 0
qualify row_number() over (partition by date_heure order by priorite, filename desc) = 1
