import datetime as dt
import json

import duckdb
import pytest

from collecte import eco2mix


class FausseReponse:
    def __init__(self, contenu: bytes):
        self.content = contenu

    def raise_for_status(self):
        pass


def parquet(tmp_path, sql: str) -> bytes:
    f = tmp_path / "src.parquet"
    duckdb.sql(f"copy ({sql}) to '{f.as_posix()}' (format parquet)")
    return f.read_bytes()


@pytest.fixture
def api(monkeypatch, tmp_path):
    """Remplace l'API par une réponse choisie et note les filtres envoyés."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    appels = []

    def installer(contenu: bytes):
        class S:
            def get(self, url, params, timeout):
                appels.append(params["where"])
                return FausseReponse(contenu)

        monkeypatch.setattr(eco2mix, "_session", S)

    return installer, appels


def test_refuse_une_reponse_qui_nest_pas_du_parquet(api, tmp_path):
    installer, _ = api
    installer(b"<html>maintenance</html>")
    with pytest.raises(ValueError):
        eco2mix.telecharger("x", "1=1", tmp_path / "f.parquet")
    assert not list(tmp_path.glob("f.parquet*"))


def test_reponse_vide_ne_laisse_aucun_fichier(api, tmp_path):
    installer, _ = api
    installer(parquet(tmp_path, "select 1 as a where false"))
    assert eco2mix.telecharger("x", "1=1", tmp_path / "f.parquet") == 0
    assert not list(tmp_path.glob("f.parquet*"))


def test_collecte_incrementale_avec_recouvrement(api, tmp_path):
    installer, appels = api
    installer(parquet(tmp_path, "select timestamptz '2026-11-23 12:00:00+00' as date_heure, 4000 as consommation"))
    t = dt.datetime(2026, 11, 23, 12, 10, tzinfo=dt.UTC)

    assert eco2mix.collecter_temps_reel(maintenant=t) == 1
    assert appels[-1] == "consommation is not null"  # première collecte : toute la fenêtre

    eco2mix.collecter_temps_reel(maintenant=t + dt.timedelta(minutes=15))
    assert appels[-1] == "consommation is not null and date_heure >= '2026-11-23T06:00:00Z'"

    etat = json.loads((tmp_path / "data/raw/eco2mix_tr/_etat.json").read_text())
    assert dt.datetime.fromisoformat(etat["derniere_date_heure"]) == dt.datetime(2026, 11, 23, 12, tzinfo=dt.UTC)
    assert len(list((tmp_path / "data/raw/eco2mix_tr").glob("date_collecte=2026-11-23/*.parquet"))) == 2
