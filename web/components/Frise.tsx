"use client";

import { useRef } from "react";
import type { Journee } from "@/lib/api";
import { heureTexte, jourTexte } from "@/lib/visuel";

interface Props {
  jour: string;
  periode: { debut: string; fin: string; jours?: string[] } | null;
  heures: string[];
  i: number;
  lecture: boolean;
  vitesse: number;
  journees: Journee[];
  onJour: (j: string) => void;
  onI: (i: number) => void;
  onLecture: () => void;
  onVitesse: (v: number) => void;
  direct: boolean;
  onDirect: () => void;
}

function voisin(jour: string, n: number, jours?: string[]) {
  if (jours?.length) {
    // version en ligne : seuls certains jours sont publiés
    const autres = n < 0 ? jours.filter((j) => j < jour) : jours.filter((j) => j > jour);
    return autres.length ? (n < 0 ? autres[autres.length - 1] : autres[0]) : jour;
  }
  return decaler(jour, n);
}

function decaler(jour: string, n: number) {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Frise({ jour, periode, heures, i, lecture, vitesse, journees, onJour, onI, onLecture, onVitesse, direct, onDirect }: Props) {
  // Échelle fixe d'une journée (0 h → 23 h) : le curseur indique l'heure, pas la part de la journée déjà publiée.
  const max = Math.max(23, heures.length - 1);
  const dispo = Math.max(0, heures.length - 1);
  const calendrier = useRef<HTMLInputElement>(null);
  return (
    <div className="panneau pointer-events-auto w-full px-3 pt-3 pb-3 md:px-5 md:pb-4">
      <div className="mb-3 flex items-center gap-2 md:gap-3">
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/80 md:inline">Machine à remonter le temps</span>
        <select
          value={journees.find((j) => j.date === jour)?.date ?? ""}
          onChange={(e) => e.target.value && onJour(e.target.value)}
          className="min-w-0 flex-1 truncate rounded-lg border border-white/15 bg-slate-900/80 px-2.5 py-1 text-slate-200 hover:border-white/35 md:w-[250px] md:flex-none md:text-xs"
          aria-label="Événements marquants"
        >
          <option value="">Événements marquants ▾</option>
          {journees.map((j) => (
            <option key={j.date + j.titre} value={j.date}>{j.titre} · {j.valeur} · {j.date.split("-").reverse().join("/")}</option>
          ))}
        </select>
        <button
          onClick={onDirect}
          disabled={direct}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-300 transition enabled:hover:bg-emerald-400/10 disabled:opacity-40 md:ml-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> <span className="md:hidden">Direct</span><span className="hidden md:inline">Revenir au direct</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-nowrap md:gap-4">
        <button
          onClick={onLecture}
          aria-label={lecture ? "Pause" : "Lecture"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-400 md:h-11 md:w-11 text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.55)] transition hover:bg-sky-300"
        >
          {lecture ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onJour(voisin(jour, -1, periode?.jours))} disabled={!!periode && voisin(jour, -1, periode.jours) === jour} className="bouton-jour" aria-label="Jour précédent">‹</button>
          {/* le champ date natif suit la langue du navigateur : on affiche nous-mêmes jj/mm/aaaa et on ouvre son calendrier */}
          <div className="relative">
            <button
              onClick={() => calendrier.current?.showPicker()}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm tabular-nums text-white hover:border-white/35"
              aria-label="Choisir une date"
            >
              {jour.split("-").reverse().join("/")}
              <svg width="13" height="13" viewBox="0 0 16 16" className="text-slate-400"><rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.4" /></svg>
            </button>
            <input
              ref={calendrier}
              type="date"
              value={jour}
              min={periode?.debut}
              max={periode?.fin}
              onChange={(e) => e.target.value && onJour(e.target.value)}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 [color-scheme:dark]"
            />
          </div>
          <button onClick={() => onJour(voisin(jour, 1, periode?.jours))} disabled={!!periode && voisin(jour, 1, periode.jours) === jour} className="bouton-jour" aria-label="Jour suivant">›</button>
        </div>

        <div className="relative order-last w-full md:order-none md:w-auto md:flex-1">
          <input
            type="range"
            min={0}
            max={max}
            value={Math.min(i, max)}
            onChange={(e) => onI(Math.min(Number(e.target.value), dispo))}
            className="frise w-full"
            // la partie de la journée pas encore publiée reste éteinte
            style={{ background: `linear-gradient(90deg, rgba(56,189,248,0.6) ${(dispo / max) * 100}%, rgba(148,163,184,0.15) ${(dispo / max) * 100}%)` }}
            aria-label="Heure"
          />
          <div className="relative mt-1 h-3 text-[10px] text-slate-500">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `calc(8px + (100% - 16px) * ${h / max})` }}>{h} h</span>
            ))}
          </div>
        </div>

        <div className="ml-auto shrink-0 text-right md:ml-0 md:w-44">
          <div className="hidden text-xs capitalize text-slate-400 md:block">{jourTexte(jour)}</div>
          <div className="text-2xl font-semibold tabular-nums text-white">{heures[i] ? heureTexte(heures[i]) : "—"}</div>
        </div>

        <div className="hidden shrink-0 overflow-hidden rounded-lg border border-white/15 text-xs md:flex">
          {[1, 3, 8].map((x) => (
            <button key={x} onClick={() => onVitesse(x)} className={`px-2.5 py-1.5 ${vitesse === x ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>
              ×{x}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
