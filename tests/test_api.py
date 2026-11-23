import datetime as dt

import pytest
from fastapi import HTTPException

from api.main import Heure, meilleur_creneau


def journee(co2):
    debut = dt.datetime(2026, 11, 24)
    return [Heure(heure_locale=debut + dt.timedelta(hours=i), consommation_mw=60000, taux_co2_g_kwh=c)
            for i, c in enumerate(co2)]


def test_trouve_la_fenetre_la_moins_carbonee():
    co2 = [30] * 24
    co2[12:15] = [10, 12, 11]  # midi : solaire
    c = meilleur_creneau(journee(co2), duree_h=3)
    assert (c.debut.hour, c.fin.hour) == (12, 15)
    assert c.taux_co2_moyen_g_kwh == 11.0
    assert c.pire_creneau_g_kwh == 30.0
    assert c.economie_vs_pire_pct == pytest.approx(63.3, abs=0.1)


def test_duree_trop_longue():
    with pytest.raises(HTTPException):
        meilleur_creneau(journee([20] * 2), duree_h=3)
