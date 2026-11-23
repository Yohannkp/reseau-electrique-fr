// Enregistre une démonstration commentée de l'app 3D (docs/demo/demo.gif).
// Prérequis : stack Docker démarrée (API :18000) et app servie sur :3000 (cd web && npm run build && npx next start -p 3000).
// Usage : node enregistrer_demo.js   puis   bash assembler_gif.sh
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:3000/";
const IMAGES = path.join(__dirname, "images");
const IPS = 10; // images par seconde capturées

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(IMAGES, { recursive: true, force: true });
  fs.mkdirSync(IMAGES);
  // Chrome avec fenêtre : la vraie carte graphique rend la 3D sans artefacts
  const navigateur = await puppeteer.launch({
    executablePath: CHROME, headless: false, defaultViewport: { width: 1440, height: 900 },
    args: ["--window-size=1460,1040", "--hide-scrollbars", "--disable-infobars", "--lang=fr-FR"],
  });
  const page = await navigateur.newPage();
  await page.goto(URL, { waitUntil: "networkidle0" });
  await pause(2500);

  // Légende à l'écran, au-dessus de la frise
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "legende-demo";
    Object.assign(d.style, {
      position: "fixed", left: "50%", bottom: "170px", transform: "translateX(-50%)", zIndex: 9999,
      padding: "12px 22px", borderRadius: "14px", background: "rgba(8,12,22,0.88)", color: "white",
      font: "600 20px Inter, system-ui, sans-serif", border: "1px solid rgba(56,189,248,0.55)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)", whiteSpace: "nowrap", transition: "opacity .3s", pointerEvents: "none",
    });
    document.body.appendChild(d);
  });
  const legende = (t) => page.evaluate((t) => { document.getElementById("legende-demo").textContent = t; }, t);

  // Capture en continu pendant tout le parcours
  let enCours = true, n = 0;
  const debut = Date.now();
  const durees = [];
  const capture = (async () => {
    let avant = Date.now();
    while (enCours) {
      const img = await page.screenshot({ type: "jpeg", quality: 88, captureBeyondViewport: false }); // sinon la page est redimensionnée à chaque capture et l'infobulle s'efface
      fs.writeFileSync(path.join(IMAGES, `${String(n).padStart(5, "0")}.jpg`), img);
      const maintenant = Date.now();
      if (n > 0) durees.push((maintenant - avant) / 1000);
      avant = maintenant;
      n++;
      const reste = 1000 / IPS - (Date.now() - maintenant);
      if (reste > 0) await pause(reste);
    }
    durees.push(1 / IPS);
  })();

  const clicTexte = (t) => page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(t))?.click(), t);
  const clicLabel = (l) => page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`)?.click(), l);
  const curseur = (label, valeur) => page.evaluate((label, valeur) => {
    const r = document.querySelector(`input[aria-label="${label}"]`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, String(valeur));
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }, label, valeur);

  // 1. Le direct
  await legende("En direct : la France heure par heure, données RTE éCO2mix");
  await pause(3500);
  // 2. Survol d'une région
  await legende("Survol d'une région : consommation, production, solde, température");
  await page.mouse.move(640, 420, { steps: 15 });
  await pause(1600);
  await page.mouse.move(800, 500, { steps: 20 });
  await pause(1800);
  await page.mouse.move(720, 885, { steps: 10 }); // souris rangée sur la frise : plus d'infobulle par-dessus la légende
  // 3. Lecture d'une journée
  await legende("Lecture : la journée défile, les tours et les échanges évoluent");
  await clicLabel("Lecture");
  await pause(5500);
  // 4. Pointe record
  await legende("Machine à remonter le temps : pointe record du 28/02/2018, la France importe");
  await page.select('select[aria-label="Événements marquants"]', "2018-02-28");
  await pause(6000);
  // 5. Record solaire
  await legende("Record solaire : 24,8 GW, CO₂ au plus bas, la France exporte");
  const solaire = await page.evaluate(() => [...document.querySelector('select[aria-label="Événements marquants"]').options].find((o) => o.text.startsWith("Record solaire"))?.value);
  await page.select('select[aria-label="Événements marquants"]', solaire);
  await pause(6000);
  // 6. Retour au direct, prévision de demain
  await clicLabel("Pause");
  await clicTexte("Revenir au direct");
  await legende("Demain selon notre modèle : meilleur créneau bas carbone");
  await pause(2000);
  await page.select("select:not([aria-label])", "6");
  await pause(2200);
  await legende("Et si demain était plus froid ? Le modèle recalcule la consommation");
  for (const v of [-6, -7, -8, -9, -10]) { await curseur("Écart de température", v); await pause(450); }
  await pause(2200);
  // 7. Mode ingénieur
  await clicTexte("Mode ingénieur");
  await legende("Mode ingénieur : fraîcheur, tests dbt, DAG Airflow, modèles MLflow");
  await pause(5000);
  await clicTexte("Mode ingénieur");
  // 8. Carte libre
  await legende("Carte 3D libre : rotation et inclinaison (deck.gl)");
  await page.mouse.move(700, 500);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(900, 470, { steps: 40 });
  await page.mouse.up({ button: "right" });
  await page.mouse.move(720, 885, { steps: 5 });
  await pause(2500);

  enCours = false;
  await capture;
  fs.writeFileSync(path.join(IMAGES, "durees.json"), JSON.stringify(durees));
  console.log(`${n} images en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  await navigateur.close();
})();
