"""Lancement manuel, sans Airflow : python -m collecte temps-reel | consolide | meteo"""

import logging
import sys

from collecte import eco2mix, meteo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
actions = {
    "temps-reel": lambda: [eco2mix.collecter_temps_reel(p) for p in eco2mix.PERIMETRES],
    "consolide": lambda: [eco2mix.collecter_consolide(p) for p in eco2mix.PERIMETRES],
    "meteo": lambda: (meteo.collecter_archive(), meteo.collecter_prevision()),
}
if len(sys.argv) != 2 or sys.argv[1] not in actions:
    sys.exit(f"usage : python -m collecte {{{' | '.join(actions)}}}")
actions[sys.argv[1]]()
