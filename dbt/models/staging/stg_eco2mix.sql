-- Une ligne par région et par quart d'heure.
-- Doublons : la donnée consolidée l'emporte sur le temps réel, puis la collecte la plus récente
-- (les noms de fichiers date_collecte=AAAA-MM-JJ/HHMMSS se trient dans l'ordre chronologique).

with brut as (
    select *, 'consolide' as source, 1 as priorite from {{ source('brut', 'eco2mix_def') }}
    union all by name
    select *, 'temps_reel' as source, 2 as priorite from {{ source('brut', 'eco2mix_tr') }}
)

select
    code_insee_region,
    libelle_region as region,
    cast(date_heure as timestamptz) as date_heure,
    try_cast(consommation as integer) as consommation_mw,
    try_cast(nucleaire as integer) as nucleaire_mw,
    try_cast(eolien as integer) as eolien_mw,
    try_cast(solaire as integer) as solaire_mw,
    try_cast(hydraulique as integer) as hydraulique_mw,
    try_cast(thermique as integer) as thermique_mw,
    try_cast(bioenergies as integer) as bioenergies_mw,
    try_cast(pompage as integer) as pompage_mw,
    try_cast(stockage_batterie as integer) as stockage_batterie_mw,
    try_cast(destockage_batterie as integer) as destockage_batterie_mw,
    try_cast(ech_physiques as integer) as echanges_physiques_mw,
    source
from brut
-- RTE publie parfois 0 pour une valeur manquante (ex. Île-de-France, 23/08/2026 18 h) : on l'écarte.
where try_cast(consommation as integer) > 0
qualify row_number() over (
    partition by code_insee_region, date_heure
    order by priorite, filename desc
) = 1
