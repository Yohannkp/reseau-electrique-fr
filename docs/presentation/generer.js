// Génère docs/presentation/reseau-electrique-fr.pptx : le projet expliqué de bout en bout.
// Usage : npm install, puis NODE_PATH=node_modules PPTX_SKILL=<dossier contenant scripts/apply_theme.js> node generer.js
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(__dirname, "reseau-electrique-fr.pptx");
const img = (p) => path.join(RACINE, p);

const THEME = {
  name: "Réseau électrique",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0B1220", lt1: "FFFFFF", dk2: "1E293B", lt2: "F1F5F9",
    accent1: "0891B2", // cyan électrique : données, flux, export
    accent2: "D97706", // ambre : import, alerte douce, choix
    accent3: "16A34A", // vert : CO2 bas, réussite
    accent4: "6366F1", // indigo : ML
    accent5: "E11D48", // rouge : erreur, piège
    accent6: "64748B", // ardoise : texte secondaire
    hlink: "0891B2", folHlink: "6366F1",
  },
};
const HEX = THEME.colors;
const NUIT = "0B1220", CODE_FOND = "0F172A", CODE_TEXTE = "E2E8F0", CODE_COMM = "7DD3FC";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13,33 × 7,5 pouces
pres.title = "Le réseau électrique français en temps réel : comment le projet fonctionne";
pres.author = "Yohann";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

// ---------- layouts ----------
const PIED = { text: "Le réseau électrique français en temps réel · github.com/Yohannkp/reseau-electrique-fr", options: { x: M, y: 7.05, w: 9, h: 0.3, fontSize: 10, color: C.accent6 } };
pres.defineSlideMaster({
  title: "TITRE",
  background: { color: NUIT },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.9, w: 7.3, h: 2.2, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left" }, text: "Titre" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.3, w: 7.3, h: 1.4, fontSize: 18, color: "94A3B8", valign: "top", align: "left" }, text: "Sous-titre" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION",
  background: { color: NUIT },
  objects: [
    { placeholder: { options: { name: "num", type: "body", x: M, y: 1.6, w: 3, h: 1.4, fontSize: 72, bold: true, color: "22D3EE" }, text: "01" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 3.0, w: 11, h: 1.2, fontSize: 40, bold: true, color: C.background1, align: "left" }, text: "Section" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.2, w: 10.5, h: 1.5, fontSize: 18, color: "94A3B8", valign: "top", align: "left" }, text: "Description" } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.35, fontSize: 10, color: "94A3B8", align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENU",
  background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.text1, valign: "middle", align: "left" }, text: "Titre" } },
    { text: PIED },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.35, fontSize: 10, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENU_SOMBRE",
  background: { color: NUIT },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.background1, valign: "middle", align: "left" }, text: "Titre" } },
    { text: { text: PIED.text, options: { ...PIED.options, color: "94A3B8" } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.6, h: 0.35, fontSize: 10, color: "94A3B8", align: "right" },
});

// ---------- outils ----------
const icones = {};
async function icone(nom, couleur) {
  const cle = nom + couleur;
  if (!icones[cle]) {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[nom], { color: "#" + couleur, size: 256 }));
    const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    icones[cle] = "image/png;base64," + png.toString("base64");
  }
  return icones[cle];
}

let section = "";
function nouvelle(masterName, titre) {
  const s = pres.addSlide({ masterName, sectionTitle: section });
  if (titre) s.addText(titre, { placeholder: "title" });
  return s;
}
function chapitre(num, titre, texte, notes) {
  section = titre;
  pres.addSection({ title: titre });
  const s = nouvelle("SECTION");
  s.addText(num, { placeholder: "num" });
  s.addText(titre, { placeholder: "title" });
  s.addText(texte, { placeholder: "body" });
  if (notes) s.addNotes(notes);
  return s;
}
function texte(s, t, o) {
  s.addText(t, { isTextBox: true, fontSize: 16, color: C.text1, valign: "top", margin: 0, ...o });
}
function puces(s, items, o) {
  const libelles = items.some((it) => Array.isArray(it)); // liste à libellés : le gras sert de repère, pas de puce
  const runs = items.map((it, k) => {
    const [gras, reste] = Array.isArray(it) ? it : [null, it];
    const fin = k < items.length - 1;
    if (!gras) return [{ text: reste, options: { bullet: !libelles, breakLine: fin } }];
    return [{ text: gras + " ", options: { bold: true } }, { text: reste, options: { breakLine: fin } }];
  }).flat();
  s.addText(runs, { isTextBox: true, fontSize: 16, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 8, ...o });
}
async function carte(s, x, y, w, h, { titre, corps, ic, couleur = HEX.accent1, fond = C.background2, taille = 15, nom }) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fond }, line: { color: fond, width: 0 }, rectRadius: 0.12, objectName: nom || titre });
  let tx = x + 0.25;
  if (ic) {
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: couleur }, line: { color: couleur, width: 0 } });
    s.addImage({ data: await icone(ic, "FFFFFF"), x: x + 0.37, y: y + 0.37, w: 0.31, h: 0.31 });
    tx = x + 0.95;
  }
  s.addText(titre, { isTextBox: true, x: tx, y: y + 0.22, w: x + w - tx - 0.2, h: 0.6, fontSize: 17, bold: true, color: C.text1, valign: "middle", margin: 0 });
  if (corps) s.addText(corps, { isTextBox: true, x: x + 0.25, y: y + 0.85, w: w - 0.5, h: h - 0.95, fontSize: taille, color: C.text2, valign: "top", margin: 0, paraSpaceAfter: 4 });
}
function code(s, x, y, w, h, fichier, lignes, taille = 12) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: CODE_FOND }, line: { color: CODE_FOND, width: 0 }, rectRadius: 0.1, objectName: "code " + fichier });
  s.addText(fichier, { isTextBox: true, x: x + 0.25, y: y + 0.12, w: w - 0.5, h: 0.3, fontSize: 10, color: "38BDF8", fontFace: "Courier New", margin: 0 });
  const runs = lignes.split("\n").map((l, k, t) => {
    const comm = /^\s*(#|--|\/\/)/.test(l);
    return { text: l.length ? l : " ", options: { color: comm ? CODE_COMM : CODE_TEXTE, italic: comm, breakLine: k < t.length - 1 } };
  });
  s.addText(runs, { isTextBox: true, x: x + 0.25, y: y + 0.45, w: w - 0.5, h: h - 0.55, fontSize: taille, fontFace: "Courier New", valign: "top", margin: 0, lineSpacingMultiple: 1.05 });
}
function noeud(s, x, y, w, h, titre, sous, couleur, sombre = false) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: sombre ? "1E293B" : "FFFFFF" }, line: { color: couleur, width: 1.75 }, rectRadius: 0.1, objectName: "nœud " + titre });
  s.addText([{ text: titre, options: { bold: true, fontSize: 14, color: sombre ? "FFFFFF" : HEX.dk1, breakLine: !!sous } }, ...(sous ? [{ text: sous, options: { fontSize: 11, color: sombre ? "94A3B8" : HEX.accent6 } }] : [])],
    { isTextBox: true, x: x + 0.08, y, w: w - 0.16, h, align: "center", valign: "middle", margin: 0 });
}
function fleche(s, x1, y1, x2, y2, couleur = HEX.accent6, pointille = false) {
  const opts = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, line: { color: couleur, width: 1.75, endArrowType: "triangle", dashType: pointille ? "dash" : "solid" } };
  if (x2 < x1) opts.flipH = true;
  if (y2 < y1) opts.flipV = true;
  s.addShape(pres.shapes.LINE, opts);
}
function chiffre(s, x, y, w, valeur, libelle, couleur = C.accent1, sombre = false, taille = 48) {
  s.addText(valeur, { isTextBox: true, x, y, w, h: 0.95, fontSize: taille, bold: true, color: couleur, margin: 0, valign: "bottom" });
  s.addText(libelle, { isTextBox: true, x, y: y + 1.0, w, h: 0.75, fontSize: 14, color: sombre ? "CBD5E1" : C.text2, margin: 0, valign: "top" });
}
function tableau(s, lignes, o) {
  const entete = lignes[0].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.dk2 } } }));
  const corps = lignes.slice(1).map((l, k) => l.map((t) => ({ text: String(t), options: { fill: { color: k % 2 ? "FFFFFF" : HEX.lt2 } } })));
  s.addTable([entete, ...corps], { fontSize: 14, color: HEX.dk1, border: { type: "solid", pt: 0.5, color: "E2E8F0" }, valign: "middle", margin: [4, 8, 4, 8], ...o });
}
const AXES = { catAxisLabelColor: HEX.accent6, valAxisLabelColor: HEX.accent6, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt", catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, dataLabelFontSize: 12, valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" } };

async function construire() {
  // =====================================================================
  section = "Ouverture";
  pres.addSection({ title: "Ouverture" });
  let s = nouvelle("TITRE");
  s.addText("Le réseau électrique français en temps réel", { placeholder: "title" });
  s.addText("Comment le projet fonctionne, étape par étape : les choix, le code, les pièges, et les réponses aux questions d'un recruteur technique", { placeholder: "body" });
  s.addImage({ path: img("docs/app/2-pointe-2018.png"), x: 8.3, y: 1.15, w: 4.6, h: 2.875, rounding: false });
  s.addText("Pointe record du 28/02/2018 à 19 h : 96,1 GW", { isTextBox: true, x: 8.3, y: 4.1, w: 4.6, h: 0.35, fontSize: 12, color: "94A3B8", margin: 0 });
  s.addNotes("Ce deck raconte le projet comme je le présenterais en entretien : d'abord pourquoi, ensuite comment c'est construit, puis chaque choix technique avec ses alternatives écartées, et enfin les questions qu'on m'a posées ou qu'on pourrait me poser. Tous les chiffres viennent du dépôt public.");

  s = nouvelle("CONTENU", "En une diapositive : ce que le projet prouve");
  chiffre(s, M, 1.5, 2.8, "3 M", "lignes éCO2mix, quart d'heure par quart d'heure, 12 régions, 2013 → aujourd'hui");
  chiffre(s, 3.7, 1.5, 2.8, "24", "tests de qualité dbt à chaque passage, toutes les 15 min", C.accent3);
  chiffre(s, 6.8, 1.5, 2.8, "1,95 %", "d'erreur de notre prévision J+1, au niveau de RTE corrigé (2,05 %)", C.accent4);
  chiffre(s, 9.9, 1.5, 2.8, "5 ms", "pour la prévision servie par l'API, grâce au cache", C.accent2);
  puces(s, [
    ["Data Engineer :", "collecte fiable et reprise après panne, orchestration Airflow, entrepôt dbt + DuckDB testé, compactage, Docker, CI."],
    ["Data Analyst :", "rapport Power BI versionné, et une vraie découverte : la « dégradation » de la prévision de RTE vient de la révision des données."],
    ["ML / MLOps :", "prévision sans fuite d'information, évaluée honnêtement contre RTE, suivie et servie par MLflow + FastAPI, réentraînée chaque semaine."],
    ["Développeur :", "API typée, app 3D Next.js + deck.gl, tests et CI sur les deux langages."],
  ], { x: M, y: 3.95, w: W - 2 * M, h: 2.9 });
  s.addNotes("Si je n'ai qu'une minute : un pipeline qui tourne pour de vrai, des tests qui ont attrapé de vraies erreurs de RTE, une prévision évaluée honnêtement, et une interface qui rend tout ça visible. Chaque métier visé a sa preuve concrète.");

  s = nouvelle("CONTENU", "Plan");
  const plan = [["01", "Pourquoi ce projet", "FaBullseye"], ["02", "Architecture et choix d'outils", "FaSitemap"], ["03", "Mise en place, étape par étape", "FaListOl"], ["04", "Analyse et Power BI", "FaChartColumn"],
    ["05", "Prévision J+1 et MLflow", "FaBrain"], ["06", "API et application 3D", "FaCube"], ["07", "Performance, qualité, CI", "FaGaugeHigh"], ["08", "Préparer l'entretien", "FaComments"]];
  for (let k = 0; k < plan.length; k++) {
    const [n, t, ic] = plan[k];
    const x = M + (k % 2) * 6.1, y = 1.45 + Math.floor(k / 2) * 1.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.85, h: 1.1, fill: { color: C.background2 }, line: { color: HEX.lt2, width: 0 }, rectRadius: 0.12, objectName: "plan " + n });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fill: { color: C.accent1 }, line: { color: HEX.accent1, width: 0 } });
    s.addImage({ data: await icone(ic, "FFFFFF"), x: x + 0.39, y: y + 0.39, w: 0.32, h: 0.32 });
    s.addText([{ text: n + "  ", options: { color: C.accent1, bold: true } }, { text: t, options: { color: C.text1, bold: true } }], { isTextBox: true, x: x + 1.05, y, w: 4.6, h: 1.1, fontSize: 18, valign: "middle", margin: 0 });
  }

  // =====================================================================
  chapitre("01", "Pourquoi ce projet", "Des projets nombreux mais petits ne font pas décrocher d'entretien. Il fallait un projet phare par métier visé, qui tourne pour de vrai, choisi à partir des offres réelles.",
    "Le point de départ est un constat de recrutement, pas une envie technique.");

  s = nouvelle("CONTENU", "Le constat : beaucoup de projets, aucun « projet phare »");
  await carte(s, M, 1.45, 3.9, 2.6, { titre: "Avant", ic: "FaFolderOpen", couleur: HEX.accent2, corps: "Des notebooks, des TP, des projets qui ne tournent pas en continu. Rien ne montre un pipeline qui vit seul." });
  await carte(s, 4.72, 1.45, 3.9, 2.6, { titre: "Ce que cherche un recruteur", ic: "FaMagnifyingGlass", couleur: HEX.accent1, corps: "Un projet qui tourne, un lien, un schéma d'architecture, un résultat chiffré, et des choix qu'on sait défendre." });
  await carte(s, 8.84, 1.45, 3.9, 2.6, { titre: "La décision", ic: "FaFlagCheckered", couleur: HEX.accent3, corps: "Un gros projet par secteur qui recrute, sur un socle commun réutilisable : Docker, Airflow, dbt, MLflow, FastAPI, Next.js + 3D." });
  texte(s, "Le métier visé en priorité est Data Engineer, avec Data Analyst et MLOps en complément. Les offres visées sont des stages en Île-de-France pour avril 2027.", { x: M, y: 4.45, w: W - 2 * M, h: 0.8, color: C.text2 });
  s.addNotes("Question probable : pourquoi refaire un projet alors que tu en as déjà ? Réponse : mes projets existants prouvaient des compétences isolées ; aucun ne prouvait que je sais faire tourner un système complet en production.");

  s = nouvelle("CONTENU", "Le choix du secteur vient des offres, pas d'une intuition");
  s.addChart(pres.charts.BAR, [{ name: "Part des offres", labels: ["Défense / aéro / spatial", "Conseil / ESN", "Retail / luxe", "Énergie / industrie", "Banque / assurance", "Tech / SaaS", "Télécom, transport, santé"], values: [32, 22, 13, 12, 8, 7, 6] }], {
    x: M, y: 1.4, w: 7.4, h: 5.3, barDir: "bar", chartColors: [HEX.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0\"%\"", dataLabelColor: HEX.dk1, showLegend: false,
    showTitle: true, title: "Part des 745 offres Data / IA / Dev dont le secteur est identifié", titleFontSize: 13, titleColor: HEX.dk2, catAxisOrientation: "maxMin", valAxisHidden: true, ...AXES,
  });
  puces(s, [
    "Environ 3 080 offres relevées par mon outil de veille, sur 9 sources.",
    "1 050 offres Data, IA et Dev gardées sur les sources générales, pour ne pas laisser Thales, Orange ou BNP peser trop lourd avec leurs propres sites.",
    "Secteur identifié pour 745 d'entre elles.",
    ["L'énergie arrive en premier", "malgré ses 12 % : ses données publiques vivantes permettent un projet Data Engineer complet, et c'est mon positionnement."],
  ], { x: 8.3, y: 1.55, w: 4.45, h: 5.2, fontSize: 15 });
  s.addNotes("Limite à connaître : un seul relevé, à un moment donné, centré IA/data en Île-de-France, et 30 % d'entreprises non identifiées. Les ordres de grandeur suffisent pour choisir.");

  s = nouvelle("CONTENU", "Pourquoi éCO2mix : des données idéales pour un vrai pipeline");
  await carte(s, M, 1.45, 3.9, 2.45, { titre: "Vivantes", ic: "FaBolt", corps: "Un point par région toutes les 15 min, publié en continu : il faut une collecte qui tourne et qui survit aux pannes." });
  await carte(s, 4.72, 1.45, 3.9, 2.45, { titre: "Ouvertes", ic: "FaScaleBalanced", couleur: HEX.accent3, corps: "Licence Ouverte v2.0 (Etalab), vérifiée avant de commencer : on peut publier le projet et ses captures." });
  await carte(s, 8.84, 1.45, 3.9, 2.45, { titre: "Profondes", ic: "FaClockRotateLeft", couleur: HEX.accent4, corps: "Historique consolidé depuis 2013 : pas besoin d'attendre des semaines de collecte pour analyser ou entraîner." });
  await carte(s, M, 4.15, 6.0, 2.55, { titre: "Une référence à battre", ic: "FaTrophy", couleur: HEX.accent2, corps: "Le jeu national contient la prévision de consommation de RTE, publiée la veille. C'est l'étalon le plus exigeant possible pour notre modèle, et une excellente histoire d'entretien." });
  await carte(s, 6.74, 4.15, 6.0, 2.55, { titre: "Des pièges réels", ic: "FaTriangleExclamation", couleur: HEX.accent5, corps: "Fenêtre temps réel de 3 mois, types qui changent d'un export à l'autre, quarts d'heure publiés vides à l'avance, valeurs à 0 MW. Exactement ce qu'un Data Engineer doit savoir gérer." });
  s.addNotes("Le choix de la source conditionne tout le projet. Un CSV Kaggle figé n'aurait permis ni collecte, ni reprise après panne, ni orchestration crédible.");

  s = nouvelle("CONTENU", "Un seul projet, une preuve pour chaque métier visé");
  tableau(s, [
    ["Métier", "Ce que le projet montre", "Où le voir"],
    ["Data Engineer", "Collecte incrémentale et reprise, Airflow, dbt + DuckDB, 24 tests, compactage, Docker, CI", "src/collecte, dags/, dbt/"],
    ["Data Analyst", "Rapport Power BI de 4 pages, mesures DAX, note d'analyse avec une décision", "powerbi/, ANALYSE.md"],
    ["ML / MLOps", "Prévision J+1 sans fuite, MLflow (suivi, registre), réentraînement hebdomadaire, API", "src/prevision, MLflow"],
    ["Développeur", "API FastAPI typée, app 3D Next.js + deck.gl, lint, typage, build en CI", "src/api, web/"],
  ], { x: M, y: 1.5, w: W - 2 * M, colW: [2.2, 7.2, 2.733], rowH: 0.75 });
  s.addNotes("C'est la diapositive à garder en tête pour adapter le discours : selon le poste, je commence par la ligne correspondante.");

  // =====================================================================
  chapitre("02", "Architecture et choix d'outils", "Une chaîne en couches : on collecte du brut qu'on ne modifie jamais, on transforme et on teste dans dbt, on expose des fichiers Parquet, et chaque usage (Power BI, modèle, API, app) lit ces fichiers.");

  s = nouvelle("CONTENU", "L'architecture d'ensemble");
  noeud(s, M, 1.55, 2.1, 0.9, "RTE éCO2mix", "API ODRÉ, 15 min", HEX.accent1);
  noeud(s, M, 2.75, 2.1, 0.9, "Open-Meteo", "12 préfectures", HEX.accent1);
  noeud(s, 3.2, 2.15, 2.0, 0.9, "Collecte", "src/collecte", HEX.dk2);
  noeud(s, 5.6, 2.15, 2.0, 0.9, "Parquet brut", "data/raw, jamais modifié", HEX.dk2);
  noeud(s, 8.0, 2.15, 2.15, 0.9, "dbt + DuckDB", "staging → marts, 24 tests", HEX.dk2);
  noeud(s, 10.55, 2.15, 2.15, 0.9, "Exports Parquet", "data/export", HEX.dk2);
  fleche(s, 2.7, 2.0, 3.2, 2.5); fleche(s, 2.7, 3.2, 3.2, 2.7);
  fleche(s, 5.2, 2.6, 5.6, 2.6); fleche(s, 7.6, 2.6, 8.0, 2.6); fleche(s, 10.15, 2.6, 10.55, 2.6);
  noeud(s, 10.55, 4.0, 2.15, 0.9, "Power BI", "PBIP, 4 pages", HEX.accent2);
  noeud(s, 8.0, 4.0, 2.15, 0.9, "Prévision", "LightGBM", HEX.accent4);
  noeud(s, 5.6, 4.0, 2.0, 0.9, "MLflow", "suivi + registre", HEX.accent4);
  noeud(s, 3.2, 4.0, 2.0, 0.9, "API FastAPI", "10 endpoints", HEX.accent3);
  noeud(s, M, 4.0, 2.1, 0.9, "App 3D", "Next.js + deck.gl", HEX.accent3);
  fleche(s, 11.6, 3.05, 11.6, 4.0); fleche(s, 11.1, 3.05, 9.1, 4.0); fleche(s, 8.0, 4.45, 7.6, 4.45); fleche(s, 5.6, 4.45, 5.2, 4.45); fleche(s, 3.2, 4.45, 2.7, 4.45);
  fleche(s, 10.55, 3.05, 4.7, 4.0, HEX.accent6, true);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.2, y: 5.35, w: 9.5, h: 0.75, fill: { color: "EEF2FF" }, line: { color: HEX.accent4, width: 1, dashType: "dash" }, rectRadius: 0.1, objectName: "bande Airflow" });
  s.addText([{ text: "Airflow 3 orchestre tout : ", options: { bold: true } }, { text: "collecte toutes les 15 min, météo chaque heure, historique chaque semaine, réentraînement le lundi, compactage chaque nuit" }], { isTextBox: true, x: 3.4, y: 5.35, w: 9.2, h: 0.75, fontSize: 14, color: C.text1, valign: "middle", margin: 0 });
  texte(s, "Le tout tourne dans Docker Compose (6 services) ; le pointillé = l'API lit aussi les exports directement.", { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontSize: 14, color: C.accent6 });
  s.addNotes("Le principe structurant : chaque couche a un seul rôle et une frontière claire. Le brut est immuable, ce qui rend tout rejouable. Les exports Parquet sont le contrat entre la partie données et ses usages : Power BI, le modèle et l'API ne lisent jamais l'entrepôt directement.");

  s = nouvelle("CONTENU", "Chaque outil, son rôle, et pourquoi pas l'alternative");
  tableau(s, [
    ["Outil", "Rôle", "Pourquoi lui", "Alternative écartée"],
    ["Airflow 3", "Orchestration", "Reprises, historique, dépendances visibles, standard des offres", "cron : ni reprise, ni état"],
    ["Parquet", "Stockage brut et exports", "Colonnes typées, compressé, lu par tous les outils", "CSV : types perdus, lourd"],
    ["dbt", "Transformations SQL", "Modèles versionnés, tests intégrés, lignage", "scripts SQL épars"],
    ["DuckDB", "Moteur analytique", "Lit le Parquet sans chargement, 3 M lignes en secondes", "PostgreSQL : un serveur de plus"],
    ["LightGBM", "Prévision", "Tabulaire, non-linéaire, rapide, gère les trous", "Prophet, réseaux : moins adaptés"],
    ["MLflow", "Suivi et registre", "Chaque essai tracé, alias « production »", "fichiers .pkl à la main"],
    ["FastAPI", "Service", "Typage Pydantic, doc OpenAPI auto", "Flask : validation à écrire"],
    ["deck.gl", "Carte 3D", "Couches GPU géospatiales, Uber / Foursquare", "Three.js : tout à refaire"],
  ], { x: M, y: 1.45, w: W - 2 * M, colW: [1.6, 2.3, 4.833, 3.4], rowH: 0.56, fontSize: 13 });
  s.addNotes("En entretien, le « pourquoi pas X » compte autant que le « pourquoi Y ». Pour DuckDB, la vraie limite est l'écrivain unique : je l'ai réglée par conception, en ne laissant qu'un seul DAG lancer dbt.");

  s = nouvelle("CONTENU", "Six services Docker, une seule commande pour tout démarrer");
  const services = [["postgres", "Métadonnées d'Airflow", "interne", HEX.accent6], ["airflow-apiserver", "Interface et API Airflow", ":18080", HEX.accent4], ["airflow-scheduler", "Planifie et exécute les tâches", "interne", HEX.accent4], ["airflow-dag-processor", "Lit les DAG", "interne", HEX.accent4], ["mlflow", "Suivi des essais, registre, artefacts", ":15000", HEX.accent4], ["api", "FastAPI : prévision, carte, pipeline", ":18000", HEX.accent3]];
  for (let k = 0; k < services.length; k++) {
    const [n, r, p, c] = services[k];
    const x = M + (k % 3) * 4.1, y = 1.5 + Math.floor(k / 3) * 1.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.85, h: 1.5, fill: { color: C.background2 }, line: { color: c, width: 1.5 }, rectRadius: 0.1, objectName: "service " + n });
    s.addText([{ text: n, options: { bold: true, fontFace: "Courier New", fontSize: 15, color: HEX.dk1, breakLine: true } }, { text: r, options: { fontSize: 14, color: HEX.dk2, breakLine: true } }, { text: "port " + p, options: { fontSize: 13, color: c } }], { isTextBox: true, x: x + 0.25, y, w: 3.4, h: 1.5, valign: "middle", margin: 0 });
  }
  code(s, M, 5.15, 7.2, 1.55, "terminal", "docker compose up -d --build\n# Airflow :18080 · MLflow :15000 · API :18000/docs\ncd web && npm run build && npm start   # carte 3D :3000", 12);
  puces(s, ["Ports liés à 127.0.0.1 : rien n'est exposé au réseau.", "Le port 8080 est réservé par Windows (Hyper-V) : Airflow passe sur 18080."], { x: 8.1, y: 5.25, w: 4.63, h: 1.45, fontSize: 14 });
  s.addNotes("Airflow 3 demande un composant de plus qu'Airflow 2 : le dag-processor séparé. Le secret JWT doit être le même pour tous les composants, sinon les tâches ne peuvent pas s'authentifier auprès de l'API d'exécution.");

  s = nouvelle("CONTENU", "Quatre semaines, dans cet ordre précis");
  const semaines = [
    ["Semaine 1", "Le socle", ["Explorer l'API et vérifier la licence", "Collecteur + historique 2013", "dbt staging + tests", "Airflow dans Docker", "GitHub public + CI"], HEX.accent1],
    ["Semaine 2", "Enrichir et analyser", ["Jeu national : CO₂ + prévision RTE", "Météo des 12 régions", "Marts d'analyse", "Power BI (PBIP)", "Note d'analyse"], HEX.accent2],
    ["Semaine 3", "Prévoir", ["Archive des prévisions météo", "Jeu de données sans fuite", "Essais jugés sur 2024", "MLflow + API", "Réentraînement hebdo"], HEX.accent4],
    ["Semaine 4", "Montrer", ["Endpoints de la carte", "App Next.js + deck.gl", "Critique de design appliquée", "Performance", "Captures + README"], HEX.accent3],
  ];
  for (let k = 0; k < 4; k++) {
    const [n, t, et, c] = semaines[k];
    const x = M + k * 3.07;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.5, w: 2.85, h: 5.15, fill: { color: C.background2 }, line: { color: HEX.lt2, width: 0 }, rectRadius: 0.12, objectName: "semaine " + (k + 1) });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.75, w: 0.5, h: 0.5, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(String(k + 1), { isTextBox: true, x: x + 0.25, y: 1.75, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText([{ text: n, options: { fontSize: 13, color: c, bold: true, breakLine: true } }, { text: t, options: { fontSize: 18, bold: true, color: HEX.dk1 } }], { isTextBox: true, x: x + 0.9, y: 1.65, w: 1.9, h: 0.75, valign: "middle", margin: 0 });
    puces(s, et, { x: x + 0.25, y: 2.65, w: 2.45, h: 3.9, fontSize: 14, paraSpaceAfter: 10 });
  }
  s.addNotes("L'ordre n'est pas arbitraire : la collecte est lancée dès le premier jour, parce que chaque jour d'historique temps réel compte, et c'est ce qui a permis plus tard de comparer temps réel et consolidé.");

  // =====================================================================
  chapitre("03", "Mise en place, étape par étape", "Chaque étape avec ce qu'on a découvert, le code qui en est sorti, et le choix fait plutôt qu'un autre.");

  s = nouvelle("CONTENU", "Étape 1 : explorer la source avant d'écrire la collecte");
  puces(s, [
    ["Deux jeux de données :", "« temps réel » (fenêtre glissante d'environ 3 mois) et « consolidé et définitif » (2013 → fin août 2026, 2,9 M lignes)."],
    ["L'export Parquet existe :", "/exports/parquet?where=… renvoie un vrai fichier Parquet. Pas de pagination JSON, types déjà présents."],
    ["Piège 1 :", "l'API publie d'avance tous les quarts d'heure de la journée, vides. Il faut filtrer « consommation is not null »."],
    ["Piège 2 :", "une même colonne arrive en nombre dans un export et en texte dans un autre (« eolien », « pompage »)."],
    ["Licence :", "Licence Ouverte v2.0, lue dans les métadonnées du jeu avant tout."],
  ], { x: M, y: 1.5, w: 6.4, h: 5.2, fontSize: 15 });
  code(s, 7.3, 1.5, 5.43, 3.0, "exploration (curl)", "GET /api/explore/v2.1/catalog/datasets/\n    eco2mix-regional-tr/exports/parquet\n    ?where=date_heure >= '2026-11-23T10:00Z'\n          and consommation is not null\n\n# → 145 lignes = 12 régions × 12 quarts\n#   d'heure, en-tête « PAR1 » : du Parquet", 12);
  await carte(s, 7.3, 4.75, 5.43, 1.95, { titre: "Pourquoi c'est décisif", ic: "FaLightbulb", couleur: HEX.accent2, corps: "La fenêtre de 3 mois rend la reprise après panne possible : tant qu'un trou fait moins de 3 mois, on peut le rattraper.", taille: 14 });
  s.addNotes("Je commence toujours par interroger la source à la main : schéma, volumétrie, fenêtre de rétention, licence. Les deux pièges découverts ici ont dicté le filtre de collecte et le typage explicite dans dbt.");

  s = nouvelle("CONTENU", "Étape 2 : un téléchargement qui ne corrompt jamais rien");
  code(s, M, 1.45, 7.6, 4.15, "src/collecte/eco2mix.py", "def telecharger(dataset, where, dest) -> int:\n    rep = _session().get(API.format(dataset),\n                         params={\"where\": where}, timeout=600)\n    rep.raise_for_status()\n    if rep.content[:4] != b\"PAR1\":\n        raise ValueError(\"la réponse n'est pas du Parquet\")\n    tmp = dest.with_name(dest.name + \".tmp\")\n    tmp.write_bytes(rep.content)\n    n = duckdb.sql(\"select count(*) from read_parquet(?)\",\n                   params=[str(tmp)]).fetchall()[0][0]\n    if n == 0:\n        tmp.unlink()\n        return 0\n    tmp.replace(dest)  # jamais de fichier à moitié écrit\n    return n", 12);
  await carte(s, 8.45, 1.45, 4.28, 1.45, { titre: "Reprises HTTP", ic: "FaRotate", corps: "5 essais, délai croissant (×2) sur 429 et 5xx.", taille: 14 });
  await carte(s, 8.45, 3.05, 4.28, 1.45, { titre: "Validation", ic: "FaShieldHalved", couleur: HEX.accent3, corps: "Signature « PAR1 » et au moins une ligne.", taille: 14 });
  await carte(s, 8.45, 4.65, 4.28, 1.45, { titre: "Écriture atomique", ic: "FaFileCircleCheck", couleur: HEX.accent4, corps: "Fichier .tmp puis renommage : dbt ne voit que du complet.", taille: 14 });
  texte(s, "Preuve en conditions réelles : une coupure DNS pendant le téléchargement de 2023 a été rattrapée seule, après 5 relances.", { x: M, y: 5.85, w: 7.6, h: 0.8, fontSize: 15, color: C.text2 });
  s.addNotes("Pourquoi le renommage ? Un renommage sur le même disque est atomique : à tout instant, le fichier final est soit absent, soit complet. Une page HTML de maintenance renvoyée avec un code 200 serait rejetée par le contrôle PAR1 au lieu d'empoisonner l'entrepôt.");

  s = nouvelle("CONTENU", "Collecte incrémentale : une panne se rattrape seule");
  code(s, M, 1.45, 6.6, 2.35, "src/collecte/eco2mix.py", "RECOUVREMENT = dt.timedelta(hours=6)\n\ndef filtre_temps_reel(derniere):\n    where = \"consommation is not null\"\n    if derniere is not None:\n        depuis = derniere - RECOUVREMENT\n        depuis = depuis.astimezone(dt.UTC)\n        where += (\" and date_heure >= \"\n                  f\"'{depuis:%Y-%m-%dT%H:%M:%S}Z'\")\n    return where", 12);
  puces(s, [
    ["Un état minuscule :", "data/raw/eco2mix_tr/_etat.json garde le dernier horodatage collecté. Lecture O(1), pas besoin de relire l'historique."],
    ["Recouvrement de 6 h :", "RTE complète et corrige les derniers quarts d'heure après coup ; on les recollecte à chaque passage."],
    ["Doublons assumés :", "on préfère recollecter que manquer une correction ; dbt résout les doublons ensuite."],
  ], { x: 7.5, y: 1.5, w: 5.23, h: 3.0, fontSize: 14 });
  const yT = 4.55;
  s.addShape(pres.shapes.LINE, { x: M, y: yT + 0.9, w: 12.1, h: 0, line: { color: HEX.accent6, width: 1.5 } });
  const evts = [[0.9, "Dernière collecte", HEX.accent1], [3.4, "Panne de 2 h", HEX.accent5], [6.4, "Collecte suivante", HEX.accent3], [9.4, "Rattrapage depuis\n« dernière − 6 h »", HEX.accent3]];
  for (const [x, t, c] of evts) {
    s.addShape(pres.shapes.OVAL, { x: M + x - 0.12, y: yT + 0.78, w: 0.24, h: 0.24, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(t, { isTextBox: true, x: M + x - 1.2, y: yT + 1.12, w: 2.4, h: 0.7, fontSize: 13, color: C.text2, align: "center", margin: 0 });
  }
  s.addShape(pres.shapes.RECTANGLE, { x: M + 3.4 - 0.9, y: yT + 0.55, w: 1.8, h: 0.7, fill: { color: "FFE4E6", transparency: 30 }, line: { color: HEX.accent5, width: 0.75, dashType: "dash" }, objectName: "panne" });
  s.addNotes("Question classique : que se passe-t-il si la collecte tombe 2 heures ? Réponse : rien de perdu. Le passage suivant part du dernier horodatage moins 6 heures et rattrape tout le trou, tant qu'il fait moins de 3 mois. Et si personne ne relance, le test dbt de fraîcheur (moins de 4 h) fait échouer le DAG : c'est l'alerte.");

  s = nouvelle("CONTENU", "Historique consolidé : chargé une fois, tenu à jour");
  puces(s, [
    ["Par année :", "15 requêtes au lieu d'une énorme ; un échec ne coûte qu'une année."],
    ["Années closes ignorées :", "si le fichier existe, on ne le retélécharge pas."],
    ["Année en cours et précédente rechargées :", "RTE y ajoute les mois consolidés au fil de l'eau."],
    ["Bornes en UTC :", "le 1er janvier 2013 à 0 h à Paris vaut 2012-12-31 23 h UTC, d'où le départ en 2012."],
  ], { x: M, y: 1.5, w: 6.3, h: 4.3, fontSize: 15 });
  code(s, 7.2, 1.5, 5.53, 3.1, "src/collecte/eco2mix.py", "for annee in range(PREMIERE_ANNEE - 1,\n                   annee_courante + 1):\n    dest = dossier / f\"annee={annee}.parquet\"\n    if (dest.exists()\n            and annee < annee_courante - 1):\n        continue   # année close déjà là\n    where = (\n      f\"date_heure >= '{annee}-01-01T00:00:00Z'\"\n      f\" and date_heure < '{annee+1}-01-01T00:00:00Z'\")\n    telecharger(dataset, where, dest)", 11);
  chiffre(s, 7.2, 4.85, 2.6, "2,97 M", "lignes après dédoublonnage (consolidé + temps réel)");
  chiffre(s, 10.1, 4.85, 2.6, "~10 min", "pour tout l'historique régional, une seule fois", C.accent2);
  s.addNotes("Le même code sert au régional et au national grâce à un petit dictionnaire de périmètres. Le DAG hebdomadaire « historique » relance cette fonction : c'est idempotent, il ne télécharge que ce qui peut avoir changé.");

  s = nouvelle("CONTENU", "Étape 3 : dbt dédoublonne et type, le brut ne change jamais");
  code(s, M, 1.45, 7.2, 4.0, "dbt/models/staging/stg_eco2mix.sql", "with brut as (\n  select *, 'consolide' as source, 1 as priorite\n    from {{ source('brut', 'eco2mix_def') }}\n  union all by name\n  select *, 'temps_reel' as source, 2 as priorite\n    from {{ source('brut', 'eco2mix_tr') }}\n)\nselect code_insee_region, ...,\n       try_cast(consommation as integer) as consommation_mw\nfrom brut\n-- RTE publie parfois 0 pour une valeur manquante\nwhere try_cast(consommation as integer) > 0\nqualify row_number() over (\n  partition by code_insee_region, date_heure\n  order by priorite, filename desc) = 1", 12);
  await carte(s, 8.05, 1.45, 4.68, 1.55, { titre: "union all by name", ic: "FaLayerGroup", corps: "Aligne les colonnes par nom : les deux jeux n'ont pas exactement les mêmes.", taille: 14 });
  await carte(s, 8.05, 3.15, 4.68, 1.55, { titre: "try_cast partout", ic: "FaWandMagicSparkles", couleur: HEX.accent2, corps: "Une colonne en texte dans un export ne casse plus rien.", taille: 14 });
  await carte(s, 8.05, 4.85, 4.68, 1.55, { titre: "Qui gagne un doublon ?", ic: "FaRankingStar", couleur: HEX.accent3, corps: "Le consolidé d'abord, puis la collecte la plus récente (nom de fichier).", taille: 14 });
  texte(s, "Les sources sont lues directement en Parquet par dbt-duckdb (external_location) : aucune étape de chargement.", { x: M, y: 5.65, w: 7.2, h: 0.9, fontSize: 14, color: C.text2 });
  s.addNotes("Pourquoi dédoublonner dans dbt plutôt qu'à la collecte ? Parce que le brut immuable rend tout rejouable : si la règle change, on reconstruit sans rien retélécharger. Le tri par nom de fichier marche parce que les fichiers sont nommés date_collecte=AAAA-MM-JJ/HHMMSS.parquet, ce qui se trie dans l'ordre chronologique.");

  s = nouvelle("CONTENU", "24 tests de qualité, qui ont trouvé de vraies erreurs");
  tableau(s, [
    ["Famille de tests", "Exemples"],
    ["Unicité", "une ligne par région × quart d'heure, par heure nationale"],
    ["Valeurs non nulles", "région, horodatage, consommation"],
    ["Bornes physiques", "consommation régionale ≤ 25 GW, CO₂ 0-300 g/kWh, température -30 à 50 °C"],
    ["Cohérence", "somme des 12 régions ≈ national (alerte au-delà de 10 %)"],
    ["Fraîcheur", "dernière donnée de moins de 4 h, sinon le DAG échoue"],
  ], { x: M, y: 1.5, w: 7.0, colW: [2.2, 4.8], rowH: 0.7, fontSize: 14 });
  await carte(s, 7.9, 1.5, 4.83, 1.65, { titre: "0 MW en Île-de-France", ic: "FaBug", couleur: HEX.accent5, corps: "23/08/2026, 18 h : une valeur manquante notée zéro. Écartée.", taille: 14 });
  await carte(s, 7.9, 3.25, 4.83, 1.65, { titre: "Écart de 14 %", ic: "FaScaleUnbalanced", couleur: HEX.accent2, corps: "Même heure : régions et national divergent. Avertissement.", taille: 14 });
  await carte(s, 7.9, 5.0, 4.83, 1.65, { titre: "Temps réel provisoire", ic: "FaSun", couleur: HEX.accent4, corps: "2 à 5 % d'écart les midis ensoleillés, corrigés par le consolidé.", taille: 14 });
  s.addNotes("Le test de fraîcheur est l'alerte du pipeline : un test en échec fait échouer la tâche dbt dans Airflow, donc le DAG apparaît en rouge. Le test de cohérence est en « warn » : le temps réel est provisoire, un écart modéré est normal, seul un écart grossier mérite l'attention.");

  s = nouvelle("CONTENU", "Étape 4 : Airflow orchestre cinq DAG");
  tableau(s, [
    ["DAG", "Fréquence", "Ce qu'il fait"],
    ["eco2mix_temps_reel", "*/15 min", "collecte régional + national en parallèle, puis dbt build (seul écrivain)"],
    ["meteo_prevision", "chaque heure (:05)", "météo des 7 derniers jours et des 2 prochains"],
    ["historique", "chaque semaine", "consolidé RTE, archive météo, prévisions de la veille"],
    ["reentrainement", "lundi 3 h", "réentraîne les modèles puis POST /recharger sur l'API"],
    ["compactage", "chaque nuit 2 h 07", "fusionne les petits fichiers des journées terminées"],
  ], { x: M, y: 1.45, w: 7.4, colW: [2.15, 1.75, 3.5], rowH: 0.62, fontSize: 13 });
  code(s, 8.25, 1.45, 4.48, 3.95, "dags/pipeline.py", "@dag(schedule=\"*/15 * * * *\",\n     **COMMUN)\ndef eco2mix_temps_reel():\n    @task\n    def collecte(perimetre): ...\n\n    @task.bash\n    def dbt_build():\n        return (\"mkdir -p data/export\"\n          \" && .../dbt/bin/dbt build\")\n\n    collecte.expand(perimetre=[\n      \"regional\", \"national\"]\n    ) >> dbt_build()", 11);
  puces(s, [
    ["catchup=False, max_active_runs=1 :", "pas de rattrapage en rafale, jamais deux passages en même temps."],
    ["2 reprises à 3 min :", "une erreur réseau passagère ne réveille personne."],
    ["dbt dans son propre environnement Python :", "ses dépendances entrent en conflit avec celles d'Airflow."],
  ], { x: M, y: 5.45, w: W - 2 * M, h: 1.4, fontSize: 14 });
  s.addNotes("Le .expand() est le mapping dynamique d'Airflow : une tâche par périmètre, exécutées en parallèle. Le compactage est planifié à 2 h 07 précisément pour tomber entre deux passages de dbt, qui tournent à :00, :15, :30 et :45 et durent une dizaine de secondes.");

  s = nouvelle("CONTENU", "Les pièges d'infrastructure rencontrés, et leur correction");
  const pieges = [
    ["Port 8080 refusé", "Windows réserve une plage de ports pour Hyper-V. Airflow passe sur 18080, configurable.", "FaPlug"],
    ["dbt contre Airflow", "Conflits de dépendances : dbt et la prévision vivent dans des venv séparés dans l'image.", "FaBoxesStacked"],
    ["LightGBM plante", "OpenMP (libgomp1) absent de l'image Airflow : ajouté en root dans le Dockerfile.", "FaMicrochip"],
    ["Chemins DuckDB", "L'entrepôt garde les chemins de qui l'a construit (/opt/airflow vs Windows) : reconstruire en entier.", "FaRoute"],
    ["DuckDB 2.0", "fetchone() n'existe plus sur une relation : fetchall()[0][0].", "FaCodeBranch"],
    ["Console Windows", "MLflow écrit un emoji : sans PYTHONUTF8=1, la console cp1252 plante l'entraînement.", "FaTerminal"],
  ];
  for (let k = 0; k < pieges.length; k++) {
    const [t, c, ic] = pieges[k];
    await carte(s, M + (k % 3) * 4.1, 1.5 + Math.floor(k / 3) * 2.65, 3.85, 2.4, { titre: t, corps: c, ic, couleur: k % 2 ? HEX.accent2 : HEX.accent5, taille: 14 });
  }
  s.addNotes("Ces pièges sont de bonnes réponses à « raconte-moi une difficulté technique ». Le point commun : à chaque fois, lire le message d'erreur jusqu'au bout et trouver la cause racine plutôt que contourner.");

  s = nouvelle("CONTENU", "Étape 5 : la météo, et une source de vérité unique");
  puces(s, [
    ["Un point par région :", "sa préfecture (12 points), envoyés en une seule requête Open-Meteo."],
    ["Trois flux :", "archive ERA5 (observé, ~5 jours de retard), prévision (7 jours passés + 2 à venir, chaque heure), prévisions émises la veille (2022 →, pour tester le modèle honnêtement)."],
    ["Priorité dans stg_meteo :", "l'archive l'emporte, sinon la prévision la plus récente ; une colonne source les distingue."],
    ["Pondération nationale :", "moyenne des régions pondérée par leur consommation."],
  ], { x: M, y: 1.5, w: 6.4, h: 4.5, fontSize: 15 });
  code(s, 7.3, 1.5, 5.43, 2.45, "dbt/seeds/regions.csv", "code_insee_region,region,prefecture,\n                       latitude,longitude\n11,Île-de-France,Paris,48.857,2.352\n24,Centre-Val de Loire,Orléans,47.903,1.909\n...\n93,Provence-Alpes-Côte d'Azur,Marseille,\n                       43.296,5.370", 11);
  await carte(s, 7.3, 4.15, 5.43, 2.5, { titre: "Pourquoi un seed dbt", ic: "FaSeedling", couleur: HEX.accent3, corps: "Les coordonnées étaient d'abord écrites dans le code Python ET dans dbt. Deux copies finissent toujours par diverger : le collecteur lit maintenant le même CSV que dbt.", taille: 14 });
  s.addNotes("La colonne source de stg_meteo est essentielle pour le modèle : il ne doit jamais apprendre avec une météo observée qu'il n'aurait pas connue au moment de prévoir.");

  s = nouvelle("CONTENU", "Les marts : une table par usage, exportée en Parquet");
  tableau(s, [
    ["Table", "Grain", "Lignes", "Usage"],
    ["fct_region_heure", "région × heure", "1 461 324", "carte 3D, analyse régionale"],
    ["fct_national_heure", "heure", "130 560", "Power BI, prévision, API"],
    ["fct_region_jour", "région × jour", "60 900", "thermosensibilité (Power BI)"],
    ["meteo_region_heure", "région × heure (48 h à venir)", "~9 000", "météo de demain pour l'API"],
    ["meteo_prevue_veille", "région × heure", "491 568", "test honnête du modèle"],
    ["dim_region", "région", "12", "noms, coordonnées"],
  ], { x: M, y: 1.45, w: 8.0, colW: [2.4, 2.4, 1.3, 1.9], rowH: 0.6, fontSize: 13 });
  code(s, 8.85, 1.45, 3.88, 1.9, "dbt/dbt_project.yml", "models:\n  reseau_electrique:\n    +materialized: table\n    marts:\n      +materialized: external", 12);
  await carte(s, 8.85, 3.55, 3.88, 3.1, { titre: "Pourquoi « external »", ic: "FaFileExport", corps: "dbt écrit lui-même les marts en Parquet. C'est la frontière : Power BI, le modèle et l'API ne touchent jamais l'entrepôt, et un seul processus y écrit.", taille: 14 });
  texte(s, "Pas de temps hétérogène : 30 min dans les anciennes années, 15 min ensuite. Les marts raisonnent donc en MW moyens par heure.", { x: M, y: 5.95, w: 8.0, h: 0.8, fontSize: 14, color: C.text2 });
  s.addNotes("Les marts nationaux ajoutent des colonnes calculées : écart à la prévision de RTE, part bas carbone selon la définition de RTE, température pondérée, nombre de régions présentes (pour repérer l'heure en cours encore incomplète).");

  // =====================================================================
  chapitre("04", "Analyse et Power BI", "Un rapport versionné comme du code, des mesures DAX qui répondent à une question, et une découverte qui change la lecture des chiffres de RTE.");

  s = nouvelle("CONTENU", "Power BI « as code » : le rapport est du texte relu dans Git");
  puces(s, [
    ["Format PBIP :", "le modèle sémantique en TMDL, le rapport en PBIR (JSON). Chaque changement est un diff lisible."],
    ["Squelette créé par Power BI Desktop :", "pour obtenir les versions exactes des schémas de la version installée."],
    ["Pages générées par un script :", "powerbi/generer_rapport.py décrit 4 pages et 22 visuels ; on modifie le script, pas la souris."],
    ["Paramètre DossierExport :", "un seul chemin à changer après un clone."],
  ], { x: M, y: 1.5, w: 6.3, h: 4.6, fontSize: 15 });
  code(s, 7.2, 1.5, 5.53, 3.55, "powerbi/generer_rapport.py", "visuel(\"clusteredBarChart\", 20, 95, 610, 390,\n  {\"Category\": [\"Régions.Région\"],\n   \"Y\": [\"Région jour.[Thermosensibilité\n          relative (%/°C)]\"]},\n  \"Consommation en plus par degré en moins\",\n  tri=(\"Région jour.[Thermosensibilité\n        relative (%/°C)]\", \"Descending\"))", 12);
  texte(s, "Modèle en étoile : faits National (heure) et Région jour, dimensions Régions et Calendrier (table DAX avec saisons et périodes).", { x: 7.2, y: 5.3, w: 5.53, h: 1.4, fontSize: 14, color: C.text2 });
  s.addNotes("Pourquoi PBIP plutôt qu'un .pbix ? Un .pbix est un binaire : impossible de relire un changement ou de le versionner proprement. Un recruteur peut ouvrir le TMDL sur GitHub et lire les mesures DAX directement.");

  s = nouvelle("CONTENU", "Des mesures DAX qui répondent à une question précise");
  code(s, M, 1.45, 6.4, 2.55, "Région jour.tmdl", "measure 'Thermosensibilité (MW/°C)' =\n  VAR froid = FILTER('Région jour',\n      'Région jour'[nb_heures] >= 23\n      && 'Région jour'[temperature_c] < 15)\n  RETURN - MAXX(LINESTX(froid,\n      'Région jour'[consommation_mw],\n      'Région jour'[temperature_c]), [Slope1])", 12);
  code(s, M, 4.15, 6.4, 2.5, "National.tmdl", "measure 'CO2 moyen (g/kWh)' =\n  -- pondéré par la consommation\n  VAR t = FILTER(National,\n      NOT ISBLANK(National[taux_co2_g_kwh]))\n  RETURN DIVIDE(\n    SUMX(t, [taux_co2_g_kwh] * [consommation_mw]),\n    SUMX(t, [consommation_mw]))", 12);
  s.addChart(pres.charts.BAR, [{ name: "MW par °C", labels: ["Île-de-France", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine", "Provence-Alpes-Côte d'Azur", "Occitanie", "Hauts-de-France", "Pays de la Loire", "Grand Est", "Normandie", "Bretagne", "Centre-Val de Loire", "Bourgogne-Franche-Comté"], values: [344, 248, 235, 213, 207, 168, 152, 138, 133, 125, 99, 81] }], {
    x: 7.25, y: 1.4, w: 5.5, h: 5.3, barDir: "bar", chartColors: [HEX.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.dk1, showLegend: false,
    showTitle: true, title: "MW de plus par degré en moins (jours < 15 °C)", titleFontSize: 13, titleColor: HEX.dk2, catAxisOrientation: "maxMin", valAxisHidden: true, ...AXES, catAxisLabelFontSize: 11,
  });
  s.addNotes("La thermosensibilité est d'abord calculée sur les données horaires : 1,5 M de lignes, plus de 25 s d'attente. Passée sur les moyennes journalières, c'est instantané, et c'est la granularité de référence : la moyenne du jour efface le cycle jour/nuit. Contrôle : la somme des régions donne environ 2 250 MW/°C, cohérent avec les 2 400 MW/°C cités par RTE.");

  s = nouvelle("CONTENU_SOMBRE", "Le rapport : 4 pages, une question par page");
  const pbi = [["docs/powerbi/1-vue-ensemble.jpg", "Vue d'ensemble"], ["docs/powerbi/2-prevision-rte.jpg", "Prévision de RTE"], ["docs/powerbi/3-regions-meteo.jpg", "Régions et météo"], ["docs/powerbi/4-co2.jpg", "CO₂"]];
  for (let k = 0; k < 4; k++) {
    const x = M + (k % 2) * 6.15, y = 1.35 + Math.floor(k / 2) * 2.85;
    s.addImage({ path: img(pbi[k][0]), x, y, w: 4.5, h: 2.48 });
    s.addText(pbi[k][1], { isTextBox: true, x: x + 4.6, y: y + 0.1, w: 1.4, h: 1.0, fontSize: 14, bold: true, color: "FFFFFF", margin: 0 });
  }
  s.addNotes("Chaque titre de visuel est une phrase qui dit ce qu'il faut voir, pas seulement ce qui est tracé : c'est ce qui distingue un rapport d'analyste d'un tableau de bord de démonstration.");

  s = nouvelle("CONTENU", "La découverte : l'erreur de RTE semble doubler en 2023");
  s.addChart(pres.charts.BAR, [{ name: "Erreur moyenne", labels: ["2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"], values: [1.3, 1.46, 1.36, 1.34, 1.4, 1.41, 1.49, 1.41, 1.54, 1.57, 1.85, 2.66, 2.7, 2.63] }], {
    x: M, y: 1.4, w: 7.6, h: 5.3, barDir: "col", chartColors: [HEX.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", dataLabelColor: HEX.dk1, showLegend: false,
    showTitle: true, title: "Erreur moyenne (%) de la prévision de la veille de RTE, sur le consolidé", titleFontSize: 13, titleColor: HEX.dk2, valAxisHidden: true, ...AXES, dataLabelFontSize: 10,
  });
  puces(s, [
    ["Ce n'est pas aléatoire :", "un biais systématique d'environ +1,1 GW, la consommation dépasse presque toujours la prévision."],
    ["Même biais la veille et le jour même :", "ce n'est donc ni la météo ni l'horizon de prévision."],
    ["Profil marqué :", "pic l'après-midi (13-15 h) et au printemps."],
    ["Il disparaît sur le temps réel :", "de septembre à novembre 2026, biais de −0,10 GW."],
  ], { x: 8.5, y: 1.55, w: 4.23, h: 5.2, fontSize: 15 });
  s.addNotes("Le réflexe d'analyste : avant de conclure « RTE prévoit moins bien », vérifier si l'erreur est du bruit ou un biais, puis le décomposer par horizon, heure et mois. C'est la décomposition qui révèle que l'écart ne vient pas de la prévision.");

  s = nouvelle("CONTENU", "Conclusion : la donnée a été révisée, pas la prévision");
  tableau(s, [
    ["Comparaison (prévision de la veille)", "Biais moyen", "Erreur moyenne"],
    ["Consolidé, 2012-2022", "+0,31 GW", "1,48 %"],
    ["Consolidé, 2023 à août 2026", "+1,10 GW", "2,69 %"],
    ["Consolidé, sept.-nov. 2023-2025", "+0,97 GW", "2,45 %"],
    ["Temps réel, sept.-nov. 2026", "−0,10 GW", "1,31 %"],
  ], { x: M, y: 1.5, w: 7.3, colW: [3.7, 1.8, 1.8], rowH: 0.62, fontSize: 14 });
  await carte(s, 8.15, 1.5, 4.58, 2.3, { titre: "Hypothèse", ic: "FaFlask", couleur: HEX.accent4, corps: "RTE prévoit la consommation mesurée en temps réel ; la consolidation la revoit ensuite à la hausse. Le profil fait penser à l'autoconsommation solaire.", taille: 14 });
  await carte(s, 8.15, 4.0, 4.58, 2.65, { titre: "Comment trancher", ic: "FaScaleBalanced", couleur: HEX.accent3, corps: "Notre pipeline garde chaque collecte temps réel. Quand RTE consolidera l'automne 2026, on aura les deux versions des mêmes heures : la révision se mesurera directement.", taille: 14 });
  puces(s, [["Recommandation :", "juger un modèle sur la donnée qu'il cherche à prévoir, sinon on lui impute 1 GW d'erreur qui n'en est pas une."], ["Limite assumée :", "3 mois de temps réel seulement, et pas encore de recouvrement avec le consolidé."]], { x: M, y: 4.85, w: 7.3, h: 1.9, fontSize: 14 });
  s.addNotes("C'est la diapositive la plus « Data Analyst » du deck : une question, des faits, une hypothèse présentée comme telle, ses limites, et une décision. On ne prétend pas avoir prouvé la cause.");

  // =====================================================================
  chapitre("05", "Prévision J+1 et MLflow", "Prévoir la veille à midi la consommation et le CO₂ de chaque heure du lendemain, sans tricher, et le comparer honnêtement à RTE.");

  s = nouvelle("CONTENU", "Règle d'or : seulement ce qu'on savait la veille à midi");
  const yL = 2.55;
  s.addShape(pres.shapes.RECTANGLE, { x: M + 8.6, y: yL - 0.95, w: 3.5, h: 2.1, fill: { color: "EEF2FF", transparency: 40 }, line: { color: HEX.accent4, width: 0.75, dashType: "dash" }, objectName: "zone inconnue" });
  s.addShape(pres.shapes.LINE, { x: M, y: yL, w: 12.1, h: 0, line: { color: HEX.dk2, width: 2 } });
  const jalons = [[0.4, "J-7", "même heure\n(conso_j7)"], [4.2, "J-2", "même heure\n(conso_j2)"], [6.8, "J-1, 0-11 h", "moyenne de la\nmatinée"], [8.35, "J-1 midi", "émission de\nla prévision"], [10.7, "Jour J", "24 heures\nà prévoir"]];
  for (const [x, t, d] of jalons) {
    const c = t === "J-1 midi" ? HEX.accent5 : t === "Jour J" ? HEX.accent4 : HEX.accent1;
    s.addShape(pres.shapes.OVAL, { x: M + x - 0.13, y: yL - 0.13, w: 0.26, h: 0.26, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(t, { isTextBox: true, x: M + x - 1.0, y: yL - 0.85, w: 2.0, h: 0.5, fontSize: 15, bold: true, color: c, align: "center", margin: 0 });
    s.addText(d, { isTextBox: true, x: M + x - 1.0, y: yL + 0.25, w: 2.0, h: 0.75, fontSize: 13, color: C.text2, align: "center", margin: 0 });
  }
  code(s, M, 3.85, 7.1, 2.85, "src/prevision/donnees.py", "# J-2 et J-7 à la même heure sont toujours\n# connus la veille à midi\nfor suffixe, decalage in ((\"j2\", \"48h\"), (\"j7\", \"168h\")):\n    r = serie.copy()\n    r.index = r.index + pd.Timedelta(decalage)\n    d = d.merge(r, left_on=\"heure\",\n                right_index=True, how=\"left\")", 12);
  await carte(s, 7.95, 3.85, 4.78, 2.85, { titre: "Vérifié par un test", ic: "FaVial", couleur: HEX.accent3, corps: "Données factices où la consommation vaut le numéro de l'heure : le test vérifie qu'aucune variable ne vient d'après la veille à midi, y compris la nuit du changement d'heure.", taille: 14 });
  s.addNotes("Pourquoi pas J-1 à la même heure ? Pour une heure de l'après-midi du jour J, la même heure la veille n'est pas encore connue à midi. On s'en tient à J-2 et J-7, plus la moyenne de la matinée de la veille, qui donne le dernier niveau observé. Les décalages sont faits en temps UTC écoulé, pour que 48 h restent 48 h même au changement d'heure.");

  s = nouvelle("CONTENU", "19 variables, toutes justifiables");
  await carte(s, M, 1.45, 3.9, 2.55, { titre: "Calendrier", ic: "FaCalendarDays", corps: "heure, jour de la semaine, saison (sinus et cosinus du jour de l'année), jours fériés, ponts, fêtes de fin d'année, année", taille: 14 });
  await carte(s, 4.72, 1.45, 3.9, 2.55, { titre: "Météo du jour J", ic: "FaTemperatureHalf", couleur: HEX.accent2, corps: "température de l'heure et moyenne du jour, ensoleillement, vent ; température moyenne de J-2 pour l'inertie des bâtiments", taille: 14 });
  await carte(s, 8.84, 1.45, 3.9, 2.55, { titre: "Historique récent", ic: "FaClockRotateLeft", couleur: HEX.accent4, corps: "consommation et CO₂ à J-2 et J-7 même heure, moyenne de la matinée de la veille", taille: 14 });
  puces(s, [
    ["Sinus / cosinus :", "le 31 décembre et le 1er janvier sont voisins ; un simple numéro de jour les mettrait aux deux extrémités."],
    ["Ponts :", "un lundi veille de férié ou un vendredi lendemain de férié consomme comme un jour à moitié chômé."],
    ["Fériés français :", "bibliothèque holidays, calculés pour chaque année (Pâques bouge)."],
  ], { x: M, y: 4.3, w: W - 2 * M, h: 2.4, fontSize: 15 });
  s.addNotes("Le vent et l'ensoleillement servent surtout au CO₂ : quand l'éolien et le solaire produisent, le gaz recule. La température sert surtout à la consommation : le chauffage électrique.");

  s = nouvelle("CONTENU", "Évaluation honnête : périodes séparées, météo de la veille");
  const per = [["Apprentissage", "2013 → 2023", "météo observée", HEX.accent1, 5.6], ["Réglage", "2024", "choix des variantes", HEX.accent2, 1.6], ["Test", "janv. 2025 → août 2026", "météo prévue la veille", HEX.accent4, 2.9], ["Temps réel", "sept. → nov. 2026", "donnée provisoire", HEX.accent3, 1.7]];
  let xP = M;
  for (const [n, d, m, c, w] of per) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: xP, y: 1.6, w: w - 0.1, h: 1.3, fill: { color: c }, line: { color: c, width: 0 }, rectRadius: 0.08, objectName: "période " + n });
    s.addText([{ text: n, options: { bold: true, fontSize: 15, breakLine: true } }, { text: d, options: { fontSize: 12, breakLine: true } }, { text: m, options: { fontSize: 12 } }], { isTextBox: true, x: xP + 0.1, y: 1.6, w: w - 0.3, h: 1.3, color: "FFFFFF", valign: "middle", margin: 0 });
    xP += w;
  }
  puces(s, [
    ["Jamais mélangées :", "on choisit sur 2024, on ne regarde le test qu'une fois le choix fait. Choisir sur le test serait tricher."],
    ["La météo de la veille :", "l'API « previous runs » d'Open-Meteo archive les prévisions telles qu'émises la veille, sans trou en 2025-2026. Le modèle est testé avec ce que RTE aussi avait."],
    ["Quatre références :", "base naïve (semaine précédente), RTE brut, RTE corrigé du biais mesuré en 2024, notre modèle."],
    ["Modèle final :", "réentraîné sur tout l'historique avec le même nombre d'arbres."],
  ], { x: M, y: 3.25, w: W - 2 * M, h: 3.5, fontSize: 15 });
  s.addNotes("La référence « RTE corrigé » est le point clé de l'honnêteté : comme RTE vise le temps réel, comparer notre modèle entraîné sur le consolidé à RTE brut nous ferait gagner grâce au décalage de niveau, pas grâce au modèle.");

  s = nouvelle("CONTENU", "Le choix des variantes, fait sur 2024 uniquement");
  tableau(s, [
    ["Variante (réglage 2024)", "Conso : erreur", "Conso : MW", "CO₂ : g/kWh"],
    ["Valeur brute, 2013 →", "1,69 %", "865", "4,93"],
    ["Cible relative, 2013 →", "1,62 %", "831", "4,39"],
    ["Relative + poids récents", "1,72 %", "883", "4,41"],
    ["Brute + poids récents", "1,80 %", "914", "5,16"],
    ["Relative, depuis 2019", "1,81 %", "930", "4,32"],
    ["Meilleure base naïve", "6,09 %", "3 247", "5,80"],
  ], { x: M, y: 1.5, w: 7.4, colW: [3.2, 1.4, 1.3, 1.5], rowH: 0.6, fontSize: 14 });
  await carte(s, 8.3, 1.5, 4.43, 2.6, { titre: "Cible relative", ic: "FaArrowsUpDown", couleur: HEX.accent4, corps: "On prévoit l'écart au niveau de la matinée de la veille. Les arbres n'extrapolent pas : prévoir un écart les rend robustes aux changements de régime.", taille: 14 });
  await carte(s, 8.3, 4.3, 4.43, 2.35, { titre: "Retenu", ic: "FaCircleCheck", couleur: HEX.accent3, corps: "Conso : relative depuis 2013. CO₂ : relative depuis 2019, car le CO₂ est passé d'environ 50 à 20 g/kWh.", taille: 14 });
  s.addNotes("Le pas d'apprentissage des essais était plus élevé (0,1) pour aller vite ; toutes les variantes ont les mêmes réglages, donc la comparaison est juste. Le modèle final est réentraîné avec un pas plus fin (0,05) et l'arrêt anticipé sur 2024.");

  s = nouvelle("CONTENU", "Résultat : égal à RTE corrigé, battu en temps réel");
  s.addChart(pres.charts.BAR, [{ name: "Erreur", labels: ["Base naïve", "RTE brut", "RTE corrigé", "Notre modèle"], values: [6.59, 2.70, 2.05, 1.95] }], {
    x: M, y: 1.4, w: 6.6, h: 5.3, barDir: "col", chartColors: [HEX.accent4], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00\"%\"", dataLabelColor: HEX.dk1, showLegend: false,
    showTitle: true, title: "Consommation J+1 : erreur moyenne, test janv. 2025 → août 2026", titleFontSize: 13, titleColor: HEX.dk2, valAxisHidden: true, ...AXES,
  });
  chiffre(s, 7.6, 1.55, 2.5, "1,95 %", "notre modèle, 1 013 MW d'erreur moyenne", C.accent4);
  chiffre(s, 10.3, 1.55, 2.5, "2,05 %", "RTE corrigé, 1 023 MW d'erreur moyenne", C.accent2);
  await carte(s, 7.6, 3.65, 5.13, 3.0, { titre: "Ce que je dis en entretien", ic: "FaHandshake", couleur: HEX.accent5, corps: "Sur la donnée consolidée, mon modèle fait jeu égal avec RTE corrigé. Sur la donnée temps réel, RTE reste nettement meilleur : 1,3 % contre 1,8 %. RTE a bien plus d'informations. Je ne prétends pas « battre RTE ».", taille: 14 });
  s.addNotes("Un recruteur se méfie d'un étudiant qui bat le gestionnaire du réseau national. Montrer qu'on connaît la limite de son propre résultat est plus convaincant que le chiffre lui-même.");

  s = nouvelle("CONTENU", "Le CO₂ du lendemain : la vraie valeur ajoutée");
  s.addChart(pres.charts.BAR, [{ name: "Erreur moyenne", labels: ["Naïf : semaine précédente", "Naïf : avant-veille", "Notre modèle"], values: [6.96, 5.56, 4.85] }], {
    x: M, y: 1.4, w: 6.6, h: 5.3, barDir: "col", chartColors: [HEX.accent3], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", dataLabelColor: HEX.dk1, showLegend: false,
    showTitle: true, title: "CO₂ J+1 : erreur moyenne (g/kWh), test janv. 2025 → août 2026", titleFontSize: 13, titleColor: HEX.dk2, valAxisHidden: true, ...AXES,
  });
  chiffre(s, 7.6, 1.55, 2.5, "−13 %", "d'erreur par rapport à la meilleure base naïve", C.accent3);
  chiffre(s, 10.3, 1.55, 2.5, "−20 %", "sur les données temps réel", C.accent3);
  puces(s, [
    ["RTE ne publie pas de prévision du CO₂", "dans éCO2mix : c'est ce qui rend l'API utile."],
    ["Pourquoi l'erreur moyenne et pas le pourcentage :", "le CO₂ français est bas (15-20 g/kWh) ; quelques g/kWh d'écart font de gros pourcentages trompeurs."],
  ], { x: 7.6, y: 3.75, w: 5.13, h: 3.0, fontSize: 15 });
  s.addNotes("Le choix de la métrique est une question d'entretien classique. Sur une grandeur proche de zéro, le pourcentage d'erreur explose ; l'erreur absolue moyenne, en g/kWh, se lit directement.");

  s = nouvelle("CONTENU", "MLflow : chaque essai tracé, un seul modèle en production");
  code(s, M, 1.45, 7.0, 3.05, "src/prevision/entrainement.py", "with mlflow.start_run(run_name=nom):\n    mlflow.log_params({**PARAMS, **VARIANTES[cible]})\n    mlflow.log_metric(\"test_modele_mae\", ...)\n    mlflow.log_text(tableau, \"comparaison.txt\")\n    info = mlflow.lightgbm.log_model(\n        modele, name=\"modele\",\n        registered_model_name=nom)\nclient.set_model_version_tag(nom, version,\n    \"cible_relative\", \"1\")\nclient.set_registered_model_alias(nom,\n    \"production\", version)", 12);
  const etapes = [["Lundi 3 h", "DAG reentrainement", HEX.accent4], ["Nouvelle version", "alias production", HEX.accent4], ["POST /recharger", "l'API recharge", HEX.accent3], ["Cache vidé", "prévisions à jour", HEX.accent3]];
  for (let k = 0; k < 4; k++) {
    const [t, d, c] = etapes[k];
    noeud(s, 7.9, 1.45 + k * 1.3, 4.83, 1.0, t, d, c);
    if (k < 3) fleche(s, 10.3, 2.45 + k * 1.3, 10.3, 2.75 + k * 1.3);
  }
  puces(s, [
    ["L'API ne connaît pas les versions :", "elle charge « models:/conso_j1@production »."],
    ["Le tag cible_relative", "dit à l'API d'ajouter le niveau de la veille à la prédiction."],
  ], { x: M, y: 4.75, w: 7.0, h: 1.95, fontSize: 14 });
  s.addNotes("Le serveur MLflow sert aussi les artefacts (--serve-artifacts) : aucun client n'a besoin de connaître le chemin du disque, qu'il tourne sous Windows ou dans un conteneur. Revenir à une version précédente revient à déplacer l'alias, puis à appeler /recharger.");

  // =====================================================================
  chapitre("06", "API et application 3D", "Une API qui sert la carte, la prévision et l'état du pipeline, et une application qui rend tout visible en un coup d'œil.");

  s = nouvelle("CONTENU", "L'API FastAPI : dix endpoints, un contrat clair");
  tableau(s, [
    ["Endpoint", "Rôle"],
    ["GET /prevision?jour=", "consommation et CO₂ prévus heure par heure (défaut : demain)"],
    ["GET /meilleur-creneau?duree_h=3", "créneau le moins carboné, gain contre le pire et la moyenne"],
    ["GET /scenario/froid?delta_c=-5", "même prévision avec des températures décalées"],
    ["GET /carte/regions, /carte/national", "valeurs horaires d'une journée pour la carte"],
    ["GET /journees-remarquables", "8 records calculés depuis les données"],
    ["GET /periode", "premier et dernier jour disponibles"],
    ["GET /pipeline", "fraîcheur, tests dbt, DAG Airflow, modèles, volumes"],
    ["GET /sante · POST /recharger", "versions servies, rechargement après réentraînement"],
  ], { x: M, y: 1.45, w: 8.1, colW: [3.5, 4.6], rowH: 0.55, fontSize: 13 });
  await carte(s, 8.95, 1.45, 3.78, 2.5, { titre: "Typée", ic: "FaListCheck", corps: "Réponses en modèles Pydantic, paramètres bornés (duree_h de 1 à 12). Doc OpenAPI sur /docs.", taille: 14 });
  await carte(s, 8.95, 4.15, 3.78, 2.5, { titre: "Robuste", ic: "FaShieldHalved", couleur: HEX.accent3, corps: "Si MLflow ou Airflow est injoignable : liste vide ou 503 explicite, jamais une 500 muette.", taille: 14 });
  s.addNotes("Les endpoints de la carte ont été écrits par un agent en parallèle du frontend, à partir d'un contrat JSON fixé à l'avance : les deux côtés ont pu avancer sans s'attendre. Les échanges transfrontaliers sont renvoyés avec la convention « positif = la France exporte », l'inverse de RTE, et c'est documenté.");

  s = nouvelle("CONTENU", "Meilleur créneau : une fenêtre glissante sur le CO₂ prévu");
  code(s, M, 1.45, 7.0, 3.7, "src/api/main.py", "def meilleur_creneau(heures, duree_h):\n    co2 = pd.Series([h.taux_co2_g_kwh for h in heures])\n    fenetres = co2.rolling(duree_h).mean().dropna()\n    if fenetres.empty:\n        raise HTTPException(422, \"durée trop longue\")\n    fin = int(fenetres.idxmin())\n    debut = fin - duree_h + 1\n    meilleur, pire = fenetres.min(), fenetres.max()\n    return Creneau(..., economie_vs_pire_pct=\n                   round((1 - meilleur / pire) * 100, 1))", 12);
  await carte(s, 7.9, 1.45, 4.83, 2.0, { titre: "Exemple réel", ic: "FaPlugCircleBolt", couleur: HEX.accent3, corps: "Recharger une voiture de 14 h à 17 h plutôt qu'au pire créneau : environ 6 % de CO₂ en moins ce jour-là.", taille: 14 });
  await carte(s, 7.9, 3.6, 4.83, 1.55, { titre: "Testé", ic: "FaVial", couleur: HEX.accent4, corps: "Un test place un creux à midi et vérifie la fenêtre trouvée.", taille: 14 });
  texte(s, "Cache : la prévision d'un jour est gardée 15 min par (jour, versions des modèles), puisque la météo prévue change au plus chaque heure. /prevision et /meilleur-creneau passent de 250 ms à 5 ms ; /recharger vide le cache.", { x: M, y: 5.4, w: W - 2 * M, h: 1.2, fontSize: 15, color: C.text2 });
  s.addNotes("C'est l'idée « Green Scheduler » : transformer une observation en aide à la décision. La complexité est volontairement faible ; ce qui a de la valeur, c'est la prévision du CO₂ qui l'alimente.");

  s = nouvelle("CONTENU", "Le bug le plus instructif : une fausse erreur CORS");
  const bug = [["Symptôme", "Le navigateur affiche « blocked by CORS policy » sur certaines requêtes, pas toutes.", HEX.accent5], ["Fausse piste", "Le CORS était pourtant configuré, et curl renvoyait bien l'en-tête attendu.", HEX.accent2], ["Cause racine", "Les requêtes simultanées partageaient la connexion DuckDB par défaut : « connection is busy ». Une 500 n'a pas l'en-tête CORS.", HEX.accent4], ["Correction", "Une connexion par requête : duckdb.connect().sql(…). Test : 8 endpoints et 20 appels simultanés, tous en 200.", HEX.accent3]];
  for (let k = 0; k < 4; k++) {
    const [t, d, c] = bug[k];
    const y = 1.45 + k * 1.33;
    s.addShape(pres.shapes.OVAL, { x: M, y: y + 0.15, w: 0.7, h: 0.7, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(String(k + 1), { isTextBox: true, x: M, y: y + 0.15, w: 0.7, h: 0.7, fontSize: 20, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText([{ text: t, options: { bold: true, fontSize: 17, color: HEX.dk1, breakLine: true } }, { text: d, options: { fontSize: 15, color: HEX.dk2 } }], { isTextBox: true, x: M + 1.0, y, w: 7.1, h: 1.1, valign: "middle", margin: 0 });
  }
  code(s, 8.95, 1.45, 3.78, 3.0, "logs de l'API", "_duckdb.ResourceInUseException:\n  connection is busy with\n  another call; it refuses\n  instead of waiting, so use\n  a separate connection", 11);
  texte(s, "Leçon : une erreur « réseau » dans le navigateur peut cacher une erreur serveur. Lire les logs du serveur avant de toucher à la configuration.", { x: 8.95, y: 4.7, w: 3.78, h: 2.0, fontSize: 14, color: C.text2 });
  s.addNotes("FastAPI exécute les endpoints synchrones dans un pool de threads : plusieurs requêtes en même temps veulent la même connexion. Une connexion DuckDB en mémoire coûte quelques microsecondes, et lit les mêmes fichiers Parquet : c'est la correction la plus simple et la plus sûre.");

  s = nouvelle("CONTENU", "L'application 3D : Next.js, deck.gl et MapLibre");
  const couches = [["GeoJsonLayer", "socles des régions, hauteur = consommation", HEX.dk2], ["PathLayer", "liseré du toit, cyan ou ambre selon le solde", HEX.accent1], ["ScatterplotLayer", "ombre douce au pied des tours", HEX.accent6], ["ColumnLayer", "tours hexagonales empilées par filière", HEX.accent2], ["PathLayer ×2", "arcs vers les voisins, avec halo", HEX.accent1], ["TripsLayer ×2", "impulsions animées dans le sens du flux", HEX.accent3], ["TextLayer", "étiquettes des voisins, hors du territoire", HEX.accent4]];
  for (let k = 0; k < couches.length; k++) {
    const [n, d, c] = couches[k];
    const y = 1.45 + k * 0.74;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 6.9, h: 0.62, fill: { color: C.background2 }, line: { color: c, width: 1.25 }, rectRadius: 0.08, objectName: "couche " + n });
    s.addText([{ text: n + "  ", options: { bold: true, fontFace: "Courier New", color: c } }, { text: d, options: { color: HEX.dk2 } }], { isTextBox: true, x: M + 0.2, y, w: 6.6, h: 0.62, fontSize: 14, valign: "middle", margin: 0 });
  }
  puces(s, [
    ["Rendu côté navigateur uniquement :", "WebGL n'existe pas côté serveur, d'où un import dynamique sans SSR."],
    ["Une seule boucle d'animation :", "impulsions et balancement de la caméra pendant la lecture."],
    ["Worker MapLibre :", "le bundler de Next.js ne sait pas l'empaqueter ; il est copié dans public/ par un script predev."],
    ["Liens directs :", "?jour=2018-02-28&heure=19."],
  ], { x: 7.85, y: 1.5, w: 4.88, h: 5.2, fontSize: 15 });
  s.addNotes("Mesuré sur la RTX 4060 : 236 images par seconde au repos, 213 en lecture, pire image à 28 ms au changement d'heure, 93 Mo de mémoire. Sur un portable sans carte dédiée, on peut compter 40 à 60 images par seconde.");

  s = nouvelle("CONTENU_SOMBRE", "Le pouls électrique de la France, en direct");
  s.addImage({ path: img("docs/app/1-aujourdhui.png"), x: 1.47, y: 1.3, w: 10.4, h: 5.5 * 1.0, sizing: { type: "contain", w: 10.4, h: 5.5 } });
  s.addNotes("Hauteur des régions : consommation. Tours : production par filière. Arcs : échanges avec les voisins. Liseré cyan : région exportatrice, ambre : importatrice. À droite, la prévision de demain, le meilleur créneau et le scénario de froid.");

  s = nouvelle("CONTENU", "Les choix de design, et ce qu'une critique a corrigé");
  await carte(s, M, 1.45, 3.9, 2.55, { titre: "Couleur réservée", ic: "FaPalette", couleur: HEX.accent1, corps: "Socles anthracite, à peine teintés : la couleur vive va aux tours et aux arcs, qui sont la donnée.", taille: 14 });
  await carte(s, 4.72, 1.45, 3.9, 2.55, { titre: "Socles opaques", ic: "FaCube", couleur: HEX.accent2, corps: "La transparence laissait voir les murs des voisins : des rayures. Contours simplifiés : 5 742 → 1 507 sommets.", taille: 14 });
  await carte(s, 8.84, 1.45, 3.9, 2.55, { titre: "Pas de « forêt de pailles »", ic: "FaTowerObservation", couleur: HEX.accent4, corps: "Tours à 62 % de l'échelle des socles, prismes hexagonaux larges, joint entre filières.", taille: 14 });
  await carte(s, M, 4.2, 3.9, 2.45, { titre: "Étiquettes lisibles", ic: "FaTag", couleur: HEX.accent3, corps: "Hors du territoire, en pastille. Le « · » manquait dans l'atlas de la police : characterSet « auto ».", taille: 14 });
  await carte(s, 4.72, 4.2, 3.9, 2.45, { titre: "Direct ou replay", ic: "FaClockRotateLeft", couleur: HEX.accent5, corps: "Badge EN DIRECT ou REPLAY, panneau « Demain » estompé en replay : aucune confusion de dates.", taille: 14 });
  await carte(s, 8.84, 4.2, 3.9, 2.45, { titre: "Frise sur 24 h", ic: "FaSliders", couleur: HEX.accent6, corps: "Le curseur indique l'heure, pas la part publiée ; dates affichées en jj/mm/aaaa par l'app.", taille: 14 });
  s.addNotes("Deux critiques de design reçues ont été appliquées point par point et transformées en règles écrites pour les projets suivants. Chaque rendu a été jugé sur une capture haute définition faite par Chrome sans interface, pas seulement dans une petite fenêtre.");

  s = nouvelle("CONTENU_SOMBRE", "Remonter le temps : la pointe record et le record solaire");
  s.addImage({ path: img("docs/app/2-pointe-2018.png"), x: M, y: 1.35, w: 5.9, h: 3.69 });
  s.addImage({ path: img("docs/app/4-record-solaire.png"), x: 6.83, y: 1.35, w: 5.9, h: 3.69 });
  s.addText([{ text: "28/02/2018, 19 h : ", options: { bold: true, color: "FBBF24" } }, { text: "96,1 GW, 88 g/kWh, la France importe 6,2 GW. Arcs ambre, régions importatrices.", options: { color: "E2E8F0" } }], { isTextBox: true, x: M, y: 5.25, w: 5.9, h: 1.2, fontSize: 15, valign: "top", margin: 0 });
  s.addText([{ text: "07/08/2026, 13 h : ", options: { bold: true, color: "34D399" } }, { text: "24,8 GW de solaire, 11 g/kWh, la France exporte 14 GW.", options: { color: "E2E8F0" } }], { isTextBox: true, x: 6.83, y: 5.25, w: 5.9, h: 1.2, fontSize: 15, valign: "top", margin: 0 });
  s.addNotes("Les journées remarquables ne sont pas codées en dur : l'API les calcule depuis les données, limitées à la période où les données régionales existent (depuis 2013), pour que chaque date proposée soit affichable.");

  s = nouvelle("CONTENU_SOMBRE", "Le mode ingénieur : l'état réel du pipeline, rien de simulé");
  s.addImage({ path: img("docs/app/3-mode-ingenieur.png"), x: M, y: 1.35, w: 7.6, h: 4.75 });
  const lignesIng = [["Fraîcheur", "dernière donnée et retard de chaque source"], ["Tests dbt", "lus dans run_results.json du dernier build"], ["Airflow", "API REST, jeton obtenu sans identifiant (local)"], ["Modèles", "version « production » et erreur de test (MLflow)"], ["Volumes", "lignes de chaque export Parquet"]];
  for (let k = 0; k < lignesIng.length; k++) {
    s.addText([{ text: lignesIng[k][0], options: { bold: true, color: "F0ABFC", breakLine: true } }, { text: lignesIng[k][1], options: { color: "CBD5E1" } }], { isTextBox: true, x: 8.5, y: 1.4 + k * 0.98, w: 4.23, h: 0.9, fontSize: 14, valign: "top", margin: 0 });
  }
  s.addNotes("Un Lead Data Engineer qui ouvre ce panneau voit immédiatement qu'on pense production : fraîcheur, qualité, orchestration et modèles au même endroit. Les appels à Airflow et MLflow sont mis en cache 60 s pour ne pas les surcharger.");

  // =====================================================================
  chapitre("07", "Performance, qualité et CI", "Mesurer avant d'optimiser : ce qui allait bien, les deux points qui allaient se dégrader, et leur correction.");

  s = nouvelle("CONTENU", "Mesurer d'abord : ce qui allait bien");
  tableau(s, [
    ["Élément", "Mesure", "Verdict"],
    ["API, la plupart des endpoints", "50 à 290 ms", "bon"],
    ["API sous charge", "20 appels simultanés, 20 réussis", "bon"],
    ["Pipeline toutes les 15 min", "collecte 2 s + dbt 10 s", "très léger"],
    ["Carte 3D au repos / en lecture", "236 / 213 images par seconde", "très fluide"],
    ["Mémoire de la page", "93 Mo", "bon"],
    ["Poids de l'app", "1,1 Mo de JavaScript (~300 Ko compressé)", "normal pour de la 3D"],
  ], { x: M, y: 1.5, w: 8.0, colW: [3.1, 3.4, 1.5], rowH: 0.62, fontSize: 14 });
  await carte(s, 8.85, 1.5, 3.88, 5.15, { titre: "Ce que je n'optimise pas", ic: "FaHand", couleur: HEX.accent6, corps: "L'entrepôt (280 Mo) est reconstruit en entier toutes les 15 min, en 10 s. Le rendre incrémental ajouterait de la complexité sans gain visible avant plusieurs années de données. Optimiser ce qui ne coûte rien, c'est de la dette.", taille: 14 });
  s.addNotes("La fluidité est mesurée dans le navigateur avec requestAnimationFrame : on compte les images sur 3 s au repos puis 5 s en lecture, et on garde la pire durée d'image.");

  s = nouvelle("CONTENU", "Trois corrections mesurées avant et après");
  s.addChart(pres.charts.BAR, [{ name: "Avant", labels: ["MLflow (Go)", "Stack Docker (Go)"], values: [2.6, 4.8] }, { name: "Après", labels: ["MLflow (Go)", "Stack Docker (Go)"], values: [0.4, 2.4] }], {
    x: M, y: 1.4, w: 6.2, h: 5.3, barDir: "col", barGrouping: "clustered", chartColors: [HEX.accent6, HEX.accent3], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", dataLabelColor: HEX.dk1,
    showLegend: true, legendPos: "b", legendFontFace: "+mn-lt", legendFontSize: 12, showTitle: true, title: "Mémoire vive", titleFontSize: 13, titleColor: HEX.dk2, valAxisHidden: true, ...AXES,
  });
  chiffre(s, 7.15, 4.55, 2.6, "250 → 5 ms", "prévision servie par l'API (cache)", C.accent2, false, 32);
  chiffre(s, 10.0, 4.55, 2.73, "70 000 → 365", "fichiers par an à relire (compactage)", C.accent1, false, 32);
  puces(s, [
    ["MLflow :", "4 processus serveur et un exécuteur de tâches GenAI inutile. Un seul processus, MLFLOW_SERVER_ENABLE_JOB_EXECUTION=false."],
    ["Cache :", "par (jour, versions des modèles), 15 min, vidé à chaque rechargement."],
    ["Compactage :", "voir la diapositive suivante."],
  ], { x: 7.15, y: 1.5, w: 5.58, h: 2.9, fontSize: 15 });
  s.addNotes("La stack complète tient maintenant en environ 2,4 Go, ce qui la rend lançable sur un portable ordinaire en parallèle d'un navigateur.");

  s = nouvelle("CONTENU", "Compactage : 200 fichiers par jour deviennent un seul");
  code(s, M, 1.45, 7.4, 3.6, "src/collecte/compactage.py", "copy (\n  select * exclude (filename)\n  from read_parquet([...], filename = true,\n                     union_by_name = true)\n  qualify row_number() over (\n    partition by {cle}\n    order by filename desc) = 1\n) to 'journee.parquet.tmp' (format parquet)\n# puis renommage atomique, PUIS suppression\n# des originaux", 12);
  puces(s, [
    ["Même règle que dbt :", "on garde la dernière version collectée de chaque mesure ; « journee » se trie après « HHMMSS »."],
    ["Sûr :", "le fichier fusionné est écrit avant toute suppression ; une coupure au milieu ne perd rien."],
    ["Idempotent :", "un second passage ne fait rien."],
    ["Planifié à 2 h 07 :", "entre deux passages de dbt."],
  ], { x: 8.25, y: 1.5, w: 4.48, h: 5.2, fontSize: 15 });
  texte(s, "Le test crée trois collectes d'une journée, dont une révision, et une journée en cours : la révision l'emporte, aucune ligne n'est perdue, la journée en cours n'est pas touchée.", { x: M, y: 5.3, w: 7.4, h: 1.4, fontSize: 14, color: C.text2 });
  s.addNotes("C'est le problème classique des « small files » des lacs de données. Sans compactage, dbt devrait ouvrir environ 70 000 fichiers par passage au bout d'un an, et ses 10 s deviendraient plusieurs minutes.");

  s = nouvelle("CONTENU", "Tests et intégration continue sur les deux langages");
  await carte(s, M, 1.45, 3.9, 2.6, { titre: "15 tests Python", ic: "FaPython", couleur: HEX.accent1, corps: "Collecte (réponse non Parquet, réponse vide, recouvrement), météo, absence de fuite, prédiction relative, compactage, meilleur créneau, endpoints.", taille: 14 });
  await carte(s, 4.72, 1.45, 3.9, 2.6, { titre: "24 tests dbt", ic: "FaDatabase", couleur: HEX.accent3, corps: "À chaque passage du pipeline, sur les vraies données : unicité, bornes, cohérence, fraîcheur.", taille: 14 });
  await carte(s, 8.84, 1.45, 3.9, 2.6, { titre: "Web", ic: "FaReact", couleur: HEX.accent4, corps: "ESLint (règles React incluses), typage TypeScript strict, build de production.", taille: 14 });
  code(s, M, 4.3, 7.4, 2.4, ".github/workflows/ci.yml", "tests:  pip install -r requirements.txt\n        ruff check . && pytest -q\n        dbt parse --project-dir dbt\nweb:    npm ci && npm run lint\n        npx tsc --noEmit && npm run build", 12);
  puces(s, [
    ["Une CI a échoué une fois :", "le type LayoutProps n'existe qu'après le build de Next.js ; remplacé par un type explicite."],
    ["Aucun secret dans le dépôt :", "audit avant publication."],
  ], { x: 8.25, y: 4.35, w: 4.48, h: 2.35, fontSize: 14 });
  s.addNotes("La CI ne lance pas dbt build : elle n'a pas les données. dbt parse vérifie que le projet compile, et les tests dbt tournent toutes les 15 min dans Airflow sur les vraies données.");

  // =====================================================================
  chapitre("08", "Préparer l'entretien", "Les rôles de chaque brique, les questions techniques qu'on m'a posées ou qu'on peut me poser, et les limites à reconnaître soi-même.");

  s = nouvelle("CONTENU", "Qui fait quoi : le rôle de chaque brique");
  tableau(s, [
    ["Brique", "Son rôle, en une phrase", "Elle ne fait pas"],
    ["src/collecte", "Écrire du brut fiable : reprises, validation, écriture atomique, incrémental", "transformer"],
    ["data/raw", "Garder la vérité brute, immuable, rejouable", "être lu par les usages"],
    ["dbt + DuckDB", "Typer, dédoublonner, tester, calculer les marts", "servir les requêtes de l'app"],
    ["data/export", "Contrat entre les données et leurs usages", "être modifié à la main"],
    ["Airflow", "Planifier, enchaîner, relancer, montrer l'état", "contenir la logique métier"],
    ["src/prevision", "Construire les variables, entraîner, évaluer, enregistrer", "servir les prédictions"],
    ["MLflow", "Tracer les essais, versionner, désigner la production", "calculer"],
    ["src/api", "Servir prévisions, carte et état du pipeline, avec cache", "écrire dans l'entrepôt"],
    ["web/", "Rendre tout lisible en 3D, direct ou replay", "calculer des données"],
  ], { x: M, y: 1.45, w: W - 2 * M, colW: [1.9, 7.0, 3.233], rowH: 0.5, fontSize: 13 });
  s.addNotes("La colonne « elle ne fait pas » est la plus importante : elle montre que les responsabilités sont séparées. Par exemple, Airflow ne contient aucune logique métier, il appelle des fonctions Python testées à part.");

  const questions = [
    ["Pourquoi Airflow et pas un cron ?", "Un cron lance et oublie. Airflow relance une tâche qui échoue, enchaîne collecte puis dbt, garde l'historique et montre l'état. C'est aussi l'outil le plus cité dans les offres."],
    ["Pourquoi DuckDB et pas PostgreSQL ?", "Moteur colonne qui lit le Parquet sans chargement : 3 M de lignes en quelques secondes, dans un fichier. Limite : un seul écrivain, réglée en ne laissant qu'un DAG lancer dbt."],
    ["Que se passe-t-il si la collecte tombe 2 h ?", "Rien de perdu : on repart du dernier horodatage moins 6 h, jusqu'à 3 mois de trou. Et le test de fraîcheur fait passer le DAG en rouge au-delà de 4 h."],
    ["Comment évites-tu les doublons ?", "On les accepte dans le brut, on les résout dans stg : consolidé d'abord, puis collecte la plus récente. Un test d'unicité le garantit, et le compactage suit la même règle."],
    ["Pourquoi du Parquet brut plutôt qu'insérer en base ?", "Le brut immuable rend tout rejouable : si une règle change, on reconstruit sans retélécharger. Et les types instables sont gérés une seule fois, dans dbt."],
    ["Comment sais-tu que les données sont bonnes ?", "24 tests à chaque passage : unicité, bornes physiques, cohérence régions/national, fraîcheur. Ils ont trouvé un 0 MW et un écart de 14 % chez RTE."],
    ["Ton modèle bat-il RTE ?", "Sur le consolidé, jeu égal avec RTE corrigé (1,95 % contre 2,05 %). Sur le temps réel, RTE est meilleur (1,3 % contre 1,8 %). Je ne prétends pas le battre."],
    ["Comment as-tu évité les fuites de données ?", "Émission la veille à midi : J-2, J-7, matinée de la veille, météo prévue la veille. Un test le vérifie, et le choix se fait sur 2024 sans regarder le test."],
    ["Pourquoi LightGBM ?", "Données tabulaires avec des effets non linéaires (température, heure), rapide, gère les trous, perte L1 robuste. Prophet gère mal de nombreuses variables ; un réseau coûte plus sans gain évident."],
    ["Pourquoi une cible relative ?", "Les arbres n'extrapolent pas. Prévoir l'écart au niveau de la veille résiste aux changements de régime : CO₂ de 4,93 à 4,32 g/kWh d'erreur sur 2024."],
    ["Comment le modèle passe-t-il en production ?", "Le lundi à 3 h, Airflow réentraîne. MLflow enregistre une version, avec l'alias production et le tag cible_relative. Airflow appelle ensuite /recharger, et le cache est vidé."],
    ["Et pour revenir en arrière ?", "On déplace l'alias « production » vers la version précédente dans MLflow, puis on appelle /recharger. Aucun redéploiement."],
    ["Pourquoi Power BI en PBIP ?", "Un .pbix est un binaire illisible dans Git. Le PBIP donne le modèle en TMDL et le rapport en JSON : versionné, relu, généré par script."],
    ["Pourquoi une API entre les données et l'app ?", "Un seul point lit les exports. Le contrat JSON est fixe, avec cache et CORS. Le front reste statique et ne connaît rien du stockage."],
    ["Le bug le plus intéressant ?", "Une fausse erreur CORS. La vraie cause : une connexion DuckDB partagée entre requêtes simultanées. Correction : une connexion par requête, prouvée sous charge."],
    ["Comment ça tiendra dans un an ?", "Compactage nocturne : 365 fichiers par an au lieu de 70 000. dbt prend 10 s ; à quelques minutes, je passerais les marts en incrémental."],
    ["Pourquoi pas Kafka ?", "La source publie au quart d'heure : du micro-batch suffit. Kafka serait de la sur-ingénierie qu'il faudrait justifier, et je ne saurais pas le justifier ici."],
    ["Comment gères-tu les fuseaux et le changement d'heure ?", "Tout est stocké en UTC. On convertit en heure de Paris pour le calendrier et l'affichage. Les jours de 23 h et de 25 h sont gérés, et un test couvre le passage à l'heure d'été."],
    ["Pourquoi l'erreur absolue pour le CO₂ ?", "Le CO₂ est proche de 15-20 g/kWh : quelques g/kWh d'écart font des pourcentages énormes et trompeurs. L'erreur en g/kWh se lit directement."],
    ["Qu'est-ce que tu ferais ensuite ?", "Mesurer la révision temps réel → consolidé sur l'automne 2026, ajouter les prix spot (ENTSO-E), passer les marts en incrémental si besoin, héberger l'app."],
  ];
  for (let p = 0; p < 5; p++) {
    s = nouvelle("CONTENU", `Questions techniques probables (${p + 1}/5)`);
    for (let k = 0; k < 4; k++) {
      const [q, r] = questions[p * 4 + k];
      const x = M + (k % 2) * 6.15, y = 1.45 + Math.floor(k / 2) * 2.7;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 5.95, h: 2.5, fill: { color: C.background2 }, line: { color: HEX.lt2, width: 0 }, rectRadius: 0.12, objectName: "question " + (p * 4 + k + 1) });
      s.addText([{ text: "Q" + (p * 4 + k + 1) + "  ", options: { color: C.accent1, bold: true } }, { text: q, options: { color: C.text1, bold: true } }], { isTextBox: true, x: x + 0.25, y: y + 0.15, w: 5.45, h: 0.6, fontSize: 16, valign: "middle", margin: 0 });
      s.addText(r, { isTextBox: true, x: x + 0.25, y: y + 0.8, w: 5.45, h: 1.6, fontSize: 14, color: C.text2, valign: "top", margin: 0 });
    }
    s.addNotes("Réponses courtes à dérouler en 30 secondes chacune ; en cas de relance, la diapositive détaillée du chapitre correspondant donne le code et les chiffres.");
  }

  s = nouvelle("CONTENU", "Les limites, dites avant qu'on me les demande");
  const limites = [["Pas hébergé", "L'app et l'API tournent en local : il faut la stack Docker. Les captures sont dans le README.", "FaCloud"], ["Rebuild complet", "L'entrepôt est reconstruit en entier : 10 s aujourd'hui, à passer en incrémental quand ce sera lent.", "FaRotate"], ["Hypothèse non prouvée", "La révision temps réel → consolidé reste à mesurer quand les deux versions se recouvriront.", "FaFlask"], ["RTE meilleur en temps réel", "Notre modèle n'a pas les informations intra-journalières de RTE.", "FaScaleBalanced"], ["Points météo", "Une préfecture par région ; une pondération par population serait plus fine.", "FaLocationDot"], ["Entrepôt partagé", "Construire depuis Windows et depuis Docker mélange les chemins : un seul environnement doit écrire.", "FaTriangleExclamation"]];
  for (let k = 0; k < limites.length; k++) {
    const [t, c, ic] = limites[k];
    await carte(s, M + (k % 3) * 4.1, 1.5 + Math.floor(k / 3) * 2.65, 3.85, 2.4, { titre: t, corps: c, ic, couleur: HEX.accent6, taille: 14 });
  }
  s.addNotes("Énoncer ses limites soi-même renverse la dynamique de l'entretien : on montre qu'on a du recul, et on choisit le terrain de la discussion.");

  s = nouvelle("TITRE");
  s.addText("Un pipeline qui tourne, des choix défendus, des limites assumées", { placeholder: "title" });
  s.addText("github.com/Yohannkp/reseau-electrique-fr\nREADME · ANALYSE.md · powerbi/ · web/ · docs/presentation/", { placeholder: "body" });
  s.addImage({ path: img("docs/app/4-record-solaire.png"), x: 8.3, y: 1.15, w: 4.6, h: 2.875 });
  s.addText("Record solaire du 07/08/2026 à 13 h : 24,8 GW", { isTextBox: true, x: 8.3, y: 4.1, w: 4.6, h: 0.35, fontSize: 12, color: "94A3B8", margin: 0 });
  s.addNotes("Conclusion en une phrase : je sais construire un système de données complet qui tourne seul, je sais pourquoi chaque pièce est là, et je sais dire où il s'arrête.");

  await pres.writeFile({ fileName: SORTIE });
  await applyTheme(SORTIE, THEME);
  console.log("écrit :", SORTIE);
}

construire().catch((e) => { console.error(e); process.exit(1); });
