from publication import statique


def test_etapes_du_workflow_presentees_comme_des_dag(monkeypatch):
    monkeypatch.setenv("ETAPES", "collecte:12,dbt:9")
    etapes = statique.etapes_orchestration()
    assert [(e["dag"], e["duree_s"], e["etat"]) for e in etapes] == [("collecte", 12.0, "success"), ("dbt", 9.0, "success")]


def test_sans_etapes(monkeypatch):
    monkeypatch.delenv("ETAPES", raising=False)
    assert statique.etapes_orchestration() == []
