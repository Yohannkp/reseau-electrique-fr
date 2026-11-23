// Captures d'écran d'Airflow et de MLflow pour le README (stack Docker démarrée).
// Usage : node captures_outils.js   → docs/outils/*.png
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SORTIE = path.join(__dirname, "..", "outils");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// clique le premier élément dont le texte ou l'aria-label contient l'un des mots
const cliquer = (page, mots) => page.evaluate((mots) => {
  const el = [...document.querySelectorAll("button, a, [role=tab], [role=radio], label")]
    .find((e) => mots.some((m) => (e.getAttribute("aria-label") ?? e.textContent ?? "").toLowerCase().includes(m.toLowerCase())));
  el?.click();
  return el ? (el.getAttribute("aria-label") || el.textContent).trim().slice(0, 40) : null;
}, mots);

async function fermerAssistant(page) {
  // panneau « MLflow Assistant » : bouton de fermeture dans son en-tête
  await page.evaluate(() => {
    const titre = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "MLflow Assistant");
    let bloc = titre;
    for (let k = 0; k < 6 && bloc; k++) {
      const boutons = bloc.querySelectorAll ? bloc.querySelectorAll("button") : [];
      if (boutons.length) { boutons[boutons.length - 1].click(); return; }
      bloc = bloc.parentElement;
    }
  });
  await pause(800);
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  for (const f of fs.readdirSync(SORTIE)) fs.unlinkSync(path.join(SORTIE, f));
  const navigateur = await puppeteer.launch({ executablePath: CHROME, headless: false, defaultViewport: { width: 1440, height: 900 }, args: ["--window-size=1460,1040", "--lang=fr-FR"] });
  const page = await navigateur.newPage();
  const capture = async (nom) => { await page.screenshot({ path: path.join(SORTIE, `${nom}.png`), captureBeyondViewport: false }); console.log(nom); };
  const aller = async (url) => { await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}); await pause(3500); };

  // Airflow
  await aller("http://localhost:18080/dags");
  await capture("airflow-dags");
  await aller("http://localhost:18080/dags/eco2mix_temps_reel");
  await capture("airflow-historique");
  console.log("graphe :", await cliquer(page, ["graph"]));
  await pause(3500);
  await capture("airflow-graphe");
  await aller("http://localhost:18080/dags/reentrainement");
  await capture("airflow-reentrainement");

  // MLflow
  await aller("http://localhost:15000/#/experiments/1/runs");
  console.log("onglet :", await cliquer(page, ["Model training"]));
  await pause(3000);
  await fermerAssistant(page);
  await aller("http://localhost:15000/#/experiments/1/runs");
  await fermerAssistant(page);
  await capture("mlflow-essais");
  await aller("http://localhost:15000/#/models/conso_j1");
  await fermerAssistant(page);
  await capture("mlflow-registre");
  await navigateur.close();
})();
