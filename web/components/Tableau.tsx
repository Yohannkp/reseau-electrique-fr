"use client";

import { useEffect, useRef, useState } from "react";
import Carte, { type Survol } from "./Carte";
import Frise from "./Frise";
import ModeIngenieur from "./ModeIngenieur";
import PanneauDemain from "./PanneauDemain";
import PanneauNational from "./PanneauNational";
import { lire, type DonneesNational, type DonneesRegions, type Journee } from "@/lib/api";
import { gw } from "@/lib/visuel";

/** Dernière heure renseignée à la fois au national et dans les régions : la journée en cours est incomplète,
 * et RTE publie le national un peu avant les régions. */
function derniereHeure(n: DonneesNational, r: DonneesRegions) {
  const idf = r.valeurs["11"]?.consommation_mw ?? [];
  for (let k = Math.min(n.consommation_mw.length, idf.length) - 1; k >= 0; k--)
    if (n.consommation_mw[k] != null && idf[k] != null) return k;
  return 0;
}

export default function Tableau() {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [periode, setPeriode] = useState<{ debut: string; fin: string } | null>(null);
  const [journees, setJournees] = useState<Journee[]>([]);
  const [jour, setJour] = useState<string | null>(null);
  const [regions, setRegions] = useState<DonneesRegions | null>(null);
  const [national, setNational] = useState<DonneesNational | null>(null);
  const [i, setI] = useState(0);
  const [lecture, setLecture] = useState(false);
  const [vitesse, setVitesse] = useState(3);
  const [survol, setSurvol] = useState<Survol | null>(null);
  // composant chargé côté navigateur uniquement (ssr: false) : window existe
  const [ingenieur, setIngenieur] = useState(() => new URLSearchParams(window.location.search).has("ingenieur"));
  const [erreur, setErreur] = useState<string | null>(null);
  const heureDemandee = useRef<number | null>(null);

  useEffect(() => {
    fetch("/regions.geojson").then((r) => r.json()).then(setGeo);
    // lien direct vers un instant : ?jour=2018-02-28&heure=19 (sinon : aujourd'hui, dernière heure publiée)
    const lien = new URLSearchParams(window.location.search);
    lire<{ debut: string; fin: string }>("/periode")
      .then((p) => { setPeriode(p); setJour(lien.get("jour") ?? p.fin); })
      .catch((e) => setErreur(String(e)));
    if (lien.get("heure")) heureDemandee.current = Number(lien.get("heure"));
    lire<Journee[]>("/journees-remarquables").then(setJournees).catch(() => setJournees([]));
  }, []);

  useEffect(() => {
    if (!jour) return;
    let actif = true;
    Promise.all([lire<DonneesRegions>(`/carte/regions?debut=${jour}&jours=1`), lire<DonneesNational>(`/carte/national?debut=${jour}&jours=1`)])
      .then(([r, n]) => {
        if (!actif) return;
        setRegions(r);
        setNational(n);
        const demandee = heureDemandee.current;
        heureDemandee.current = null;
        setI((x) => demandee ?? (jour === periode?.fin ? derniereHeure(n, r) : Math.min(x, n.heures.length - 1)));
      })
      .catch((e) => setErreur(String(e)));
    return () => { actif = false; };
  }, [jour, periode]);

  // Lecture : une heure toutes les 900 ms divisées par la vitesse, en boucle sur la journée.
  useEffect(() => {
    if (!lecture || !national || !regions) return;
    const fin = derniereHeure(national, regions);
    const id = setInterval(() => setI((x) => (x >= fin ? 0 : x + 1)), 900 / vitesse);
    return () => clearInterval(id);
  }, [lecture, vitesse, national, regions]);

  const choisirJour = (j: string) => { setJour(j); setI(0); setLecture(true); };
  const direct = !!periode && jour === periode.fin;
  const revenirAuDirect = () => { if (periode) { setLecture(false); setJour(periode.fin); } };
  const r = survol && regions?.valeurs[survol.code];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#05070d] text-slate-100">
      <Carte geo={geo} regions={regions} national={national} i={i} rotation={lecture} onSurvol={setSurvol} />

      {/* voile de bord : l'œil reste au centre, les panneaux se détachent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(3,5,10,0.85)_100%)]" />

      <header className="pointer-events-none absolute left-6 top-5 z-20">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Le pouls électrique de la France</h1>
        <p className="mt-0.5 max-w-xl text-[13px] text-slate-400">
          Hauteur des régions : consommation. Tours : production par filière. Arcs : échanges avec les voisins.
        </p>
        <p className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded bg-[rgb(64,224,255)] shadow-[0_0_6px_rgb(64,224,255)]" />région exportatrice</span>
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded bg-[rgb(255,150,60)] shadow-[0_0_6px_rgb(255,150,60)]" />importatrice</span>
          <span>· données RTE éCO2mix, heure par heure</span>
        </p>
      </header>

      <button
        onClick={() => setIngenieur((x) => !x)}
        className={`absolute right-6 top-6 z-30 rounded-full border px-4 py-1.5 font-mono text-xs transition ${
          ingenieur ? "border-fuchsia-300 bg-fuchsia-400/20 text-white" : "border-white/20 bg-black/40 text-slate-300 hover:border-fuchsia-300/60 hover:text-white"
        }`}
      >
        {"</>"} Mode ingénieur
      </button>

      <div className="pointer-events-auto absolute left-6 top-[136px] z-20"><PanneauNational n={national} i={i} direct={direct} jour={jour} /></div>
      {!ingenieur && (
        // en replay, la prévision de demain reste visible mais passe au second plan : aucune confusion de dates
        <div className={`pointer-events-auto absolute right-6 top-20 z-20 transition duration-500 ${direct ? "" : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"}`}>
          <PanneauDemain />
        </div>
      )}
      {ingenieur && <ModeIngenieur onFermer={() => setIngenieur(false)} />}

      <div className="absolute inset-x-6 bottom-5 z-20">
        {jour && (
          <Frise
            jour={jour}
            periode={periode}
            heures={national?.heures ?? []}
            i={i}
            lecture={lecture}
            vitesse={vitesse}
            journees={journees}
            onJour={choisirJour}
            direct={direct}
            onDirect={revenirAuDirect}
            onI={(x) => { setI(x); setLecture(false); }}
            onLecture={() => setLecture((x) => !x)}
            onVitesse={setVitesse}
          />
        )}
      </div>

      {survol && r && (
        <div className="panneau pointer-events-none absolute z-40 w-56 p-3 text-xs" style={{ left: survol.x + 16, top: survol.y + 16 }}>
          <div className="text-sm font-semibold text-white">{survol.nom}</div>
          <div className="mt-1 grid grid-cols-2 gap-y-0.5 text-slate-300">
            <span>Consommation</span><span className="text-right tabular-nums">{gw(r.consommation_mw[i])} GW</span>
            <span>Production</span><span className="text-right tabular-nums">{gw(r.production_mw[i])} GW</span>
            <span>Solde</span><span className="text-right tabular-nums">{(r.solde_mw[i] ?? 0) >= 0 ? "+" : ""}{gw(r.solde_mw[i])} GW</span>
            <span>Température</span><span className="text-right tabular-nums">{r.temperature_c[i]?.toLocaleString("fr-FR") ?? "—"} °C</span>
          </div>
        </div>
      )}

      {erreur && (
        <div className="absolute left-1/2 top-24 z-50 -translate-x-1/2 rounded-xl border border-amber-400/40 bg-black/80 px-4 py-2 text-xs text-amber-200">
          Données indisponibles : {erreur.slice(0, 200)}
        </div>
      )}
    </main>
  );
}
