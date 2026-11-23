"use client";

import { useEffect, useRef, useState } from "react";
import Carte, { type Survol } from "./Carte";
import Frise from "./Frise";
import ModeIngenieur from "./ModeIngenieur";
import PanneauDemain from "./PanneauDemain";
import PanneauNational from "./PanneauNational";
import { BASE, lire, STATIQUE, type DonneesNational, type DonneesRegions, type Journee } from "@/lib/api";
import { couleurCo2, gw, heureTexte } from "@/lib/visuel";

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
  const [periode, setPeriode] = useState<{ debut: string; fin: string; jours?: string[] } | null>(null);
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
  const [feuille, setFeuille] = useState<"france" | "demain" | null>(null); // téléphone : détails dans un panneau du bas
  // mise en page compacte sous 768 px de large (même seuil que le préfixe md: de Tailwind)
  const [compacte, setCompacte] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const suivre = () => setCompacte(m.matches);
    m.addEventListener("change", suivre);
    return () => m.removeEventListener("change", suivre);
  }, []);

  useEffect(() => {
    fetch(`${BASE}/regions.geojson`).then((r) => r.json()).then(setGeo);
    // lien direct vers un instant : ?jour=2018-02-28&heure=19 (sinon : aujourd'hui, dernière heure publiée)
    const lien = new URLSearchParams(window.location.search);
    lire<{ debut: string; fin: string; jours?: string[] }>("/periode")
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

  const choisirJour = (j: string) => {
    if (periode?.jours && !periode.jours.includes(j)) {
      setErreur(`Version en ligne : seuls les ${periode.jours.length} jours publiés sont disponibles (les 14 derniers et les journées remarquables). Toute l'histoire depuis 2013 est dans la version Docker.`);
      return;
    }
    setErreur(null);
    setJour(j); setI(0); setLecture(true);
  };
  const direct = !!periode && jour === periode.fin;
  const revenirAuDirect = () => { if (periode) { setLecture(false); setJour(periode.fin); } };
  const r = survol && regions?.valeurs[survol.code];

  return (
    <main
      className="relative h-[100dvh] w-screen overflow-hidden bg-[#05070d] text-slate-100"
      // la souris passe de la carte à un panneau : deck.gl ne le voit pas, l'infobulle resterait affichée
      onPointerMove={(e) => { if (survol && (e.target as HTMLElement).closest(".panneau")) setSurvol(null); }}
    >
      {/* key : passer d'une mise en page à l'autre recrée la carte avec le cadrage adapté */}
      <Carte key={compacte ? "compacte" : "large"} geo={geo} regions={regions} national={national} i={i} rotation={lecture} onSurvol={setSurvol} compacte={compacte} />

      {/* voile de bord : l'œil reste au centre, les panneaux se détachent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(3,5,10,0.85)_100%)]" />

      <header className="pointer-events-none absolute left-4 right-16 top-[max(12px,env(safe-area-inset-top))] z-20 md:left-6 md:right-auto md:top-5">
        <h1 className="text-lg font-semibold tracking-tight text-white md:text-[26px]">Le pouls électrique de la France</h1>
        <p className="mt-0.5 hidden max-w-xl text-[13px] text-slate-400 md:block">
          Hauteur des régions : consommation. Tours : production par filière. Arcs : échanges avec les voisins.
        </p>
        <p className="mt-1 hidden items-center gap-3 text-[11px] text-slate-500 md:flex">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded bg-[rgb(64,224,255)] shadow-[0_0_6px_rgb(64,224,255)]" />région exportatrice</span>
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded bg-[rgb(255,150,60)] shadow-[0_0_6px_rgb(255,150,60)]" />importatrice</span>
          <span>· données RTE éCO2mix, heure par heure</span>
          {STATIQUE && <span className="rounded-full border border-sky-400/30 px-2 py-0.5 text-sky-300/90">version en ligne · mise à jour chaque heure</span>}
        </p>
      </header>

      <button
        onClick={() => setIngenieur((x) => !x)}
        aria-label="Mode ingénieur"
        className={`absolute right-4 top-[max(12px,env(safe-area-inset-top))] z-40 rounded-full border px-3 py-1.5 font-mono text-xs transition md:right-6 md:top-6 md:px-4 ${
          ingenieur ? "border-fuchsia-300 bg-fuchsia-400/20 text-white" : "border-white/20 bg-black/40 text-slate-300 hover:border-fuchsia-300/60 hover:text-white"
        }`}
      >
        {"</>"}<span className="hidden md:inline"> Mode ingénieur</span>
      </button>

      {/* Téléphone : un bandeau compact en haut, les détails dans un panneau qu'on ouvre en bas */}
      {national && (
        <div className="pointer-events-none absolute inset-x-3 top-[calc(max(12px,env(safe-area-inset-top))+36px)] z-20 md:hidden">
          <div className="panneau flex items-center gap-3 px-3 py-2 text-[11px]">
            <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${direct ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
              {direct ? "Direct" : "Replay"} · {national.heures[i] ? heureTexte(national.heures[i]) : ""}
            </span>
            <span className="tabular-nums text-white"><b className="text-base">{gw(national.consommation_mw[i])}</b> GW</span>
            <span className="tabular-nums" style={{ color: national.taux_co2_g_kwh[i] != null ? couleurCo2(national.taux_co2_g_kwh[i]!) : undefined }}>
              <b className="text-base">{national.taux_co2_g_kwh[i] ?? "—"}</b> g/kWh
            </span>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute left-6 top-[136px] z-20 hidden md:block"><PanneauNational n={national} i={i} direct={direct} jour={jour} /></div>
      {!ingenieur && !compacte && (
        // en replay, la prévision de demain reste visible mais passe au second plan : aucune confusion de dates
        <div className={`pointer-events-auto absolute right-6 top-20 z-20 transition duration-500 ${direct ? "" : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"}`}>
          <PanneauDemain />
        </div>
      )}
      {ingenieur && <ModeIngenieur onFermer={() => setIngenieur(false)} />}

      <div className="absolute inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-20 md:inset-x-6 md:bottom-5">
        {compacte && (
          <div className="mb-2 flex gap-2">
            {(["france", "demain"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFeuille((x) => (x === f ? null : f))}
                className={`panneau flex-1 py-2 text-sm font-semibold ${feuille === f ? "text-sky-300" : "text-slate-200"}`}
              >
                {f === "france" ? "France, détails" : "Demain"}
              </button>
            ))}
          </div>
        )}
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

      {compacte && feuille && (
        // panneau du bas : détails nationaux ou prévision de demain, défilable, fermé d'un geste sur la poignée
        <div className="absolute inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/10 bg-[#070b14]/95 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <button onClick={() => setFeuille(null)} aria-label="Fermer" className="sticky top-0 z-10 flex w-full justify-center bg-[#070b14]/95 py-3">
            <span className="h-1.5 w-12 rounded-full bg-white/30" />
          </button>
          <div className="px-3">
            {feuille === "france" ? <PanneauNational n={national} i={i} direct={direct} jour={jour} /> : <PanneauDemain />}
          </div>
        </div>
      )}

      {survol && r && (
        <div className="panneau pointer-events-none absolute z-40 w-56 p-3 text-xs" style={{ left: Math.min(survol.x + 16, window.innerWidth - 236), top: Math.min(survol.y + 16, window.innerHeight - 150) }}>
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
        <div className="absolute inset-x-3 top-28 z-50 rounded-xl border border-amber-400/40 bg-black/80 px-4 py-2 text-xs text-amber-200 md:inset-x-auto md:left-1/2 md:top-24 md:-translate-x-1/2">
          Données indisponibles : {erreur.slice(0, 200)}
        </div>
      )}
    </main>
  );
}
