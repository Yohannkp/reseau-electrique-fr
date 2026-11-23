import numpy as np
import pandas as pd

from prevision.donnees import VARIABLES, construire


def donnees_factices(jours=21):
    """Consommation = numéro de l'heure : on lit directement l'heure d'origine de chaque variable."""
    heures = pd.date_range("2025-03-01", periods=24 * jours, freq="h", tz="UTC")
    nat = pd.DataFrame({
        "heure": heures,
        "heure_locale": heures.tz_convert("Europe/Paris").tz_localize(None),
        "consommation_mw": np.arange(len(heures), dtype=float),
        "taux_co2_g_kwh": np.arange(len(heures), dtype=float),
        "prevision_j1_mw": 0.0,
        "source": "consolide",
    })
    meteo = pd.DataFrame({"heure": heures, "temperature": 10.0, "rayonnement": 0.0, "vent": 5.0})
    return nat, construire(nat, meteo)


def test_aucune_variable_ne_vient_d_apres_la_veille_a_midi():
    nat, d = donnees_factices()
    d = d.dropna(subset=["conso_j7", "conso_veille_matin"])
    assert not d.empty
    # instant d'émission : la veille à midi, heure de Paris, exprimé en numéro d'heure UTC
    emission = (d["jour"] - pd.Timedelta(hours=12)).dt.tz_localize("Europe/Paris").dt.tz_convert("UTC")
    rang_emission = (emission - nat["heure"].iloc[0]).dt.total_seconds() / 3600
    for col in ("conso_j2", "conso_j7", "conso_veille_matin", "co2_j2", "co2_j7", "co2_veille_matin"):
        assert (d[col] < rang_emission).all(), col


def test_retards_exacts():
    _, d = donnees_factices()
    ligne = d.dropna(subset=["conso_j7"]).iloc[0]
    rang = ligne["consommation_mw"]
    assert ligne["conso_j2"] == rang - 48
    assert ligne["conso_j7"] == rang - 168


def test_calendrier_et_colonnes():
    _, d = donnees_factices(jours=70)  # jusqu'en mai : lundi de Pâques 2025 = 21 avril
    assert set(VARIABLES) <= set(d.columns)
    paques = d[d["jour"] == "2025-04-21"]
    assert (paques["ferie"] == 1).all()
    assert len(d) == 24 * 70  # aucune ligne dupliquée ou perdue par les jointures


def test_prediction_relative_ajoute_le_niveau_de_la_veille(monkeypatch):
    from prevision import entrainement

    class Modele:
        def predict(self, X, num_iteration=None):
            return np.full(len(X), 100.0)  # écart prévu au niveau de la veille

    d = pd.DataFrame({v: [0.0, 0.0] for v in VARIABLES})
    d["conso_veille_matin"] = [50000.0, 60000.0]
    monkeypatch.setitem(entrainement.VARIANTES, "consommation_mw", {"relative": True, "poids_recents": 0, "debut": "2013"})
    assert entrainement.predire(Modele(), d, "consommation_mw").tolist() == [50100.0, 60100.0]
    monkeypatch.setitem(entrainement.VARIANTES, "consommation_mw", {"relative": False, "poids_recents": 0, "debut": "2013"})
    assert entrainement.predire(Modele(), d, "consommation_mw").tolist() == [100.0, 100.0]
