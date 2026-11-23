-- Une région française consomme entre quelques centaines de MW et ~20 GW (record national ~102 GW, 12 régions).
select *
from {{ ref('stg_eco2mix') }}
where consommation_mw <= 0 or consommation_mw > 25000
