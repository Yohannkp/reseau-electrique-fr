"""Écrit les pages et les visuels du rapport Power BI (format PBIR) à partir d'une description compacte.

Le rapport est ainsi du code relu et versionné : modifier ce fichier puis le relancer, plutôt que de
déplacer les visuels à la main. Usage : python powerbi/generer_rapport.py
"""

import json
import pathlib
import shutil

RAPPORT = pathlib.Path(__file__).parent / "reseau-electrique.Report" / "definition"
SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition"
L, H = 1280, 720
BLEU, GRIS = "#12239E", "#605E5C"


def lit(v):
    return {"expr": {"Literal": {"Value": v}}}


def texte(s: str):
    return lit("'" + s.replace("'", "''") + "'")


def champ(ref: str):
    """'Table.Colonne' ou 'Table.[Mesure]'."""
    table, nom = ref.split(".", 1)
    if nom.startswith("["):
        nom = nom[1:-1]
        f = {"Measure": {"Expression": {"SourceRef": {"Entity": table}}, "Property": nom}}
    else:
        f = {"Column": {"Expression": {"SourceRef": {"Entity": table}}, "Property": nom}}
    return f, f"{table}.{nom}", nom


def visuel(type_, x, y, w, h, roles=None, titre=None, tri=None, objets=None):
    v = {"visualType": type_, "drillFilterOtherVisuals": True}
    if roles:
        etat = {}
        for role, refs in roles.items():
            proj = []
            for r in refs:
                f, q, n = champ(r)
                proj.append({"field": f, "queryRef": q, "nativeQueryRef": n})
            etat[role] = {"projections": proj}
        v["query"] = {"queryState": etat}
        if tri:
            f, _, _ = champ(tri[0])
            v["query"]["sortDefinition"] = {"sort": [{"field": f, "direction": tri[1]}], "isDefaultSort": True}
    if objets:
        v["objects"] = objets
    c = {"position": {"x": x, "y": y, "z": 0, "height": h, "width": w}, "visual": v}
    if titre:
        c["visual"]["visualContainerObjects"] = {
            "title": [{"properties": {"show": lit("true"), "text": texte(titre)}}],
            "subTitle": [{"properties": {"show": lit("false")}}],
        }
    return c


def couleurs_mesures(table, couleurs: dict):
    return {"dataPoint": [{"properties": {"fill": {"solid": {"color": texte(c)}}}, "selector": {"metadata": f"{table}.{m}"}}
                          for m, c in couleurs.items()]}


def couleurs_valeurs(colonne, couleurs: dict):
    f, _, _ = champ(colonne)
    return {"dataPoint": [{"properties": {"fill": {"solid": {"color": texte(c)}}}, "selector": {"data": [{"scopeId": {
        "Comparison": {"ComparisonKind": 0, "Left": f, "Right": {"Literal": {"Value": f"'{v}'"}}}}}]}}
        for v, c in couleurs.items()]}


# Couleurs proches de celles d'éCO2mix, pour qu'un lecteur du secteur s'y retrouve.
FILIERES = {"Nucléaire": "#E4A701", "Hydraulique": "#2772B2", "Éolien": "#74CDB9", "Solaire": "#F27406",
            "Bioénergies": "#166A57", "Gaz": "#F30A0A", "Charbon et fioul": "#8356A2"}
AXE_CATEGORIEL = {"categoryAxis": [{"properties": {"axisType": texte("Categorical")}}]}
SAISONS = {"Hiver": "#2772B2", "Printemps": "#4CAF50", "Été": "#F27406", "Automne": "#8D5A2B"}
PERIODES = {"2012-2022": "#A0A0A0", "Depuis 2023": "#12239E"}


def zone_texte(x, y, w, h, paragraphes):
    """paragraphes : liste de (texte, taille en pt, gras, couleur)."""
    p = []
    for s, taille, gras, couleur in paragraphes:
        style = {"fontSize": f"{taille}pt", "color": couleur}
        if gras:
            style["fontWeight"] = "bold"
        p.append({"textRuns": [{"value": s, "textStyle": style}]})
    return {
        "position": {"x": x, "y": y, "z": 0, "height": h, "width": w},
        "visual": {"visualType": "textbox", "objects": {"general": [{"properties": {"paragraphs": p}}]}},
    }


def entete(titre, sous_titre):
    return zone_texte(20, 10, 1000, 75, [(titre, 18, True, BLEU), (sous_titre, 10, False, GRIS)])


def filtre_annee(x=1040):
    return visuel("slicer", x, 15, 220, 60, {"Values": ["Calendrier.Année"]},
                  objets={"data": [{"properties": {"mode": texte("Dropdown")}}]})


def carte(x, mesure, titre):
    return visuel("card", x, 95, 295, 110, {"Values": [f"National.[{mesure}]"]}, titre,
                  objets={"categoryLabels": [{"properties": {"show": lit("false")}}]})


SOURCE = "Source : RTE éCO2mix (ODRÉ, Licence Ouverte v2.0), météo Open-Meteo (CC BY 4.0). Pipeline Airflow + dbt."

PAGES = {
    "vue_ensemble": ("Vue d'ensemble", [
        entete("Le réseau électrique français, de 2012 à aujourd'hui", SOURCE),
        filtre_annee(),
        carte(20, "Consommation (TWh)", "Consommation (TWh)"),
        carte(330, "Pointe (GW)", "Pointe de consommation (GW)"),
        carte(640, "CO2 moyen (g/kWh)", "CO₂ moyen (g/kWh)"),
        carte(950, "Part bas carbone", "Part bas carbone de la production"),
        visuel("lineChart", 20, 220, 610, 480, {"Category": ["Calendrier.Mois"], "Y": ["National.[Consommation moyenne (GW)]"]},
               "Consommation moyenne par mois (GW) : le chauffage fait doubler la demande en hiver"),
        visuel("columnChart", 650, 220, 610, 480, {
            "Category": ["Calendrier.Année"],
            "Y": [f"National.[{m} (TWh)]" for m in
                  ["Nucléaire", "Hydraulique", "Éolien", "Solaire", "Bioénergies", "Gaz", "Charbon et fioul"]],
        }, "Production par filière (TWh)", tri=("Calendrier.Année", "Ascending"),
            objets=couleurs_mesures("National", {f"{k} (TWh)": c for k, c in FILIERES.items()})),
    ]),
    "prevision_rte": ("Prévision de RTE", [
        entete("Depuis 2023, la consommation dépasse la prévision de RTE d'environ 1 GW",
               "Écart entre la consommation consolidée et la prévision publiée la veille (J-1) et le jour même (J)."),
        visuel("clusteredColumnChart", 20, 95, 610, 300, {"Category": ["Calendrier.Année"], "Y": ["National.[Erreur prévision J-1 (%)]"]},
               "Erreur moyenne de la prévision de la veille (%)", tri=("Calendrier.Année", "Ascending")),
        visuel("lineChart", 650, 95, 610, 300, {
            "Category": ["Calendrier.Mois"], "Y": ["National.[Biais prévision J-1 (GW)]", "National.[Biais prévision J (GW)]"]},
            "Biais mensuel (GW) : identique la veille et le jour même",
            objets=couleurs_mesures("National", {"Biais prévision J-1 (GW)": "#12239E", "Biais prévision J (GW)": "#E66C37"})),
        visuel("lineChart", 20, 410, 610, 290, {
            "Category": ["National.heure_du_jour"], "Series": ["Calendrier.Période"], "Y": ["National.[Biais prévision J-1 (GW)]"]},
            "Biais selon l'heure de la journée (GW)", tri=("National.heure_du_jour", "Ascending"),
            objets=couleurs_valeurs("Calendrier.Période", PERIODES)),
        zone_texte(650, 410, 610, 290, [
            ("Ce que montrent les données", 13, True, BLEU),
            (("• Le biais est le même pour la prévision de la veille et celle du jour : ce n'est donc ni la météo "
             "ni l'horizon de prévision."), 10, False, "#252423"),
            (("• Il culmine l'après-midi et au printemps, et disparaît sur les données temps réel (depuis septembre 2026, "
             "pas encore consolidées)."), 10, False, "#252423"),
            (("• Hypothèse : RTE prévoit la consommation mesurée en temps réel, que la consolidation revoit ensuite "
             "à la hausse. À vérifier quand RTE consolidera l'automne 2026, que notre pipeline garde en version temps réel."),
             10, False, "#252423"),
            (("Conséquence : un modèle de prévision doit être jugé sur la donnée qu'il cherche à prévoir, "
             "sinon on lui impute 1 GW d'erreur qui n'en est pas une."), 10, True, "#252423"),
        ]),
    ]),
    "regions_meteo": ("Régions et météo", [
        entete("Dans l'Ouest et le Sud, chaque degré en moins pèse presque deux fois plus",
               "Thermosensibilité : consommation supplémentaire pour chaque degré en moins, jours à moins de 15 °C (régression sur les moyennes journalières)."),
        filtre_annee(),
        visuel("clusteredBarChart", 20, 95, 610, 390, {"Category": ["Régions.Région"], "Y": ["Région jour.[Thermosensibilité relative (%/°C)]"]},
               "Consommation en plus par degré en moins (% de la consommation)",
               tri=("Région jour.[Thermosensibilité relative (%/°C)]", "Descending")),
        visuel("clusteredBarChart", 650, 95, 610, 390, {"Category": ["Régions.Région"], "Y": ["Région jour.[Solde moyen (GW)]"]},
               "Solde moyen production − consommation (GW) : qui exporte, qui importe",
               tri=("Région jour.[Solde moyen (GW)]", "Descending")),
        visuel("scatterChart", 20, 500, 1240, 210, {
            "Category": ["Calendrier.Date"], "Series": ["Calendrier.Saison"],
            "X": ["National.[Température moyenne (°C)]"], "Y": ["National.[Consommation moyenne (GW)]"]},
            "Un point par jour : consommation moyenne (GW) selon la température (°C). En dessous de 15 °C, le chauffage prend le relais",
            objets=couleurs_valeurs("Calendrier.Saison", SAISONS)),
    ]),
    "co2": ("CO₂", [
        entete("Quand l'électricité française est-elle la plus décarbonée ?",
               "Taux de CO₂ (g/kWh) selon l'heure et la saison, pondéré par la consommation."),
        filtre_annee(),
        visuel("lineChart", 20, 95, 800, 605, {
            "Category": ["National.heure_du_jour"], "Series": ["Calendrier.Saison"], "Y": ["National.[CO2 moyen (g/kWh)]"]},
            "CO₂ moyen (g/kWh) par heure de la journée et par saison", tri=("National.heure_du_jour", "Ascending"),
            objets=couleurs_valeurs("Calendrier.Saison", SAISONS)),
        visuel("clusteredColumnChart", 840, 95, 420, 605, {"Category": ["Calendrier.Année"], "Y": ["National.[CO2 moyen (g/kWh)]"]},
               "CO₂ moyen par année (g/kWh) : pics en 2017 et 2022, années de faible production nucléaire",
               tri=("Calendrier.Année", "Ascending"), objets=AXE_CATEGORIEL),
    ]),
}


def ecrire(chemin: pathlib.Path, contenu: dict):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    pages = RAPPORT / "pages"
    shutil.rmtree(pages, ignore_errors=True)
    for nom, (titre, visuels) in PAGES.items():
        ecrire(pages / nom / "page.json", {
            "$schema": f"{SCHEMA}/page/2.1.0/schema.json",
            "name": nom, "displayName": titre, "displayOption": "FitToPage", "height": H, "width": L,
        })
        for i, v in enumerate(visuels):
            vid = f"{nom}_{i:02d}"
            v["position"]["z"] = i
            v["position"]["tabOrder"] = i
            ecrire(pages / nom / "visuals" / vid / "visual.json",
                   {"$schema": f"{SCHEMA}/visualContainer/2.14.0/schema.json", "name": vid, **v})
    ecrire(pages / "pages.json", {
        "$schema": f"{SCHEMA}/pagesMetadata/1.1.0/schema.json",
        "pageOrder": list(PAGES), "activePageName": next(iter(PAGES)),
    })
    print(f"{len(PAGES)} pages, {sum(len(v) for _, v in PAGES.values())} visuels écrits")


if __name__ == "__main__":
    main()
