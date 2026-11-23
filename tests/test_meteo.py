import duckdb

from collecte import meteo


def test_ecrit_une_ligne_par_region_et_par_heure(tmp_path):
    lignes = [
        {"code_insee_region": "11", "time": ["2026-01-01T00:00", "2026-01-01T01:00"],
         "temperature_2m": [3.5, 3.1], "shortwave_radiation": [0, 0], "wind_speed_100m": [12, 14]},
        {"code_insee_region": "93", "time": ["2026-01-01T00:00", "2026-01-01T01:00"],
         "temperature_2m": [9.0, None], "shortwave_radiation": [0, 0], "wind_speed_100m": [30, 28]},
    ]
    dest = tmp_path / "m.parquet"

    assert meteo._ecrire(lignes, dest) == 3  # l'heure sans température ne compte pas
    rows = duckdb.sql(
        f"select code_insee_region, strftime(heure at time zone 'UTC', '%H'), temperature_2m "
        f"from '{dest.as_posix()}' order by 1, 2"
    ).fetchall()
    assert rows == [("11", "00", 3.5), ("11", "01", 3.1), ("93", "00", 9.0), ("93", "01", None)]
    assert sorted(p.name for p in tmp_path.iterdir()) == ["m.parquet"]  # pas de fichier temporaire laissé


def test_regions_completes():
    assert len(meteo.REGIONS) == 12
