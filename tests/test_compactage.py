import datetime as dt

import duckdb

from collecte import compactage


def ecrire(chemin, sql):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    duckdb.connect().sql(f"copy ({sql}) to '{chemin.as_posix()}' (format parquet)")


def test_fusionne_et_garde_la_derniere_version(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    jour = tmp_path / "raw" / "eco2mix_national_tr" / "date_collecte=2026-11-22"
    h = "timestamptz '2026-11-22 10:00:00+00'"
    ecrire(jour / "100000.parquet", f"select {h} as date_heure, 50000 as consommation")
    ecrire(jour / "101500.parquet", f"select {h} as date_heure, 51000 as consommation")  # même quart d'heure, révisé
    ecrire(jour / "103000.parquet", f"select {h} + interval 15 minute as date_heure, 52000 as consommation")
    aujourdhui = tmp_path / "raw" / "eco2mix_national_tr" / "date_collecte=2026-11-23"
    ecrire(aujourdhui / "080000.parquet", f"select {h} + interval 1 day as date_heure, 60000 as consommation")

    assert compactage.compacter(dt.date(2026, 11, 23)) == 3

    assert [f.name for f in jour.iterdir()] == ["journee.parquet"]
    lignes = duckdb.connect().sql(f"select consommation from '{(jour / 'journee.parquet').as_posix()}' order by date_heure").fetchall()
    assert lignes == [(51000,), (52000,)]  # la révision l'emporte, aucune ligne perdue
    assert len(list(aujourdhui.iterdir())) == 1  # la journée en cours n'est pas touchée

    assert compactage.compacter(dt.date(2026, 11, 23)) == 0  # idempotent
