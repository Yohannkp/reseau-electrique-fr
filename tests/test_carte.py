import json

import pandas as pd

from api.carte import export_depuis_rte, journees_remarquables, lire_run_results


def test_echanges_signe_inverse():
    # RTE : négatif = la France exporte ; l'API : positif = exporte
    assert export_depuis_rte(pd.Series([-2500, 300])).tolist() == [2500, -300]


def test_journees_remarquables():
    heures = pd.date_range("2026-01-01", periods=48, freq="h")
    h = pd.DataFrame({"heure_locale": heures, "consommation_mw": 50000.0, "solaire_mw": 0.0, "eolien_mw": 1000.0,
                      "taux_co2_g_kwh": 30.0, "echanges_physiques_mw": -5000.0})
    h.loc[10, "consommation_mw"] = 90000  # pointe le 1er janvier à 10 h
    h.loc[30, "echanges_physiques_mw"] = -15000  # record d'export le 2 janvier à 6 h
    h.loc[24:, "taux_co2_g_kwh"] = 80  # le 2 janvier est le plus carboné
    r = {j["titre"]: j for j in journees_remarquables(h)}
    assert (r["Pointe de consommation"]["date"], r["Pointe de consommation"]["valeur"]) == ("2026-01-01", "90,0 GW")
    assert (r["Record d'export"]["date"], r["Record d'export"]["valeur"]) == ("2026-01-02", "15,0 GW")
    assert r["Journée la plus carbonée"]["date"] == "2026-01-02"
    assert len(r) == 8


def test_run_results(tmp_path):
    def res(uid, statut):
        return {"unique_id": uid, "status": statut, "execution_time": 0.5}
    brut = {"metadata": {"generated_at": "2026-11-23T14:45:09Z"}, "elapsed_time": 12.34,
            "results": [res("model.p.fct", "success"), res("test.p.unique_x.abc", "pass"), res("test.p.coherence", "warn")]}
    (tmp_path / "run_results.json").write_text(json.dumps(brut))
    d = lire_run_results(tmp_path)
    assert (d["tests"], d["reussis"], d["avertissements"], d["echecs"]) == (2, 1, 1, 0)
    assert d["resultats"][0]["nom"] == "fct"
    assert lire_run_results(tmp_path / "absent")["date"] is None
