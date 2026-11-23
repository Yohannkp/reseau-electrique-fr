"""Lancement manuel, sans Airflow : python -m collecte temps-reel | consolide"""

import logging
import sys

from collecte.eco2mix import collecter_consolide, collecter_temps_reel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
actions = {"temps-reel": collecter_temps_reel, "consolide": collecter_consolide}
if len(sys.argv) != 2 or sys.argv[1] not in actions:
    sys.exit(f"usage : python -m collecte {{{' | '.join(actions)}}}")
actions[sys.argv[1]]()
