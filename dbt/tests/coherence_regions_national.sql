-- La somme des 12 régions doit égaler la consommation nationale. Le temps réel est provisoire (écarts de 2 à 5 %
-- les midis ensoleillés, corrigés par le consolidé) : on n'alerte qu'au-delà de 10 %, signe d'une vraie anomalie.
{{ config(severity = 'warn') }}
select heure, consommation_mw, consommation_regions_mw
from {{ ref('fct_national_heure') }}
where nb_regions = 12
  and abs(consommation_regions_mw - consommation_mw) / consommation_mw > 0.10
