"use client";

import type { Journee } from "@/lib/api";
import { heureTexte, jourTexte } from "@/lib/visuel";

interface Props {
  jour: string;
  periode: { debut: string; fin: string } | null;
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

function decaler(jour: string, n: number) {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Frise({ jour, periode, heures, i, lecture, vitesse, journees, onJour, onI, onLecture, onVitesse, direct, onDirect }: Props) {
  const max = Math.max(0, heures.length - 1);
  return (
    <div className="panneau pointer-events-auto w-full px-5 pt-3 pb-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">Machine à remonter le temps</span>
        <select
          value={journees.find((j) => j.date === jour)?.date ?? ""}
          onChange={(e) => e.target.value && onJour(e.target.value)}
          className="rounded-lg border border-white/15 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-200 hover:border-white/35"
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
          className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-300 transition enabled:hover:bg-emerald-400/10 disabled:opacity-40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Revenir au direct
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onLecture}
          aria-label={lecture ? "Pause" : "Lecture"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-400 text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.55)] transition hover:bg-sky-300"
        >
          {lecture ? (
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onJour(decaler(jour, -1))} disabled={!!periode && jour <= periode.debut} className="bouton-jour" aria-label="Jour précédent">‹</button>
          <input
            type="date"
            value={jour}
            min={periode?.debut}
            max={periode?.fin}
            onChange={(e) => e.target.value && onJour(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white [color-scheme:dark]"
          />
          <button onClick={() => onJour(decaler(jour, 1))} disabled={!!periode && jour >= periode.fin} className="bouton-jour" aria-label="Jour suivant">›</button>
        </div>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={max}
            value={Math.min(i, max)}
            onChange={(e) => onI(Number(e.target.value))}
            className="frise w-full"
            aria-label="Heure"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            {[0, 6, 12, 18].map((h) => <span key={h}>{h} h</span>)}
            <span>24 h</span>
          </div>
        </div>

        <div className="w-44 shrink-0 text-right">
          <div className="text-xs capitalize text-slate-400">{jourTexte(jour)}</div>
          <div className="text-2xl font-semibold tabular-nums text-white">{heures[i] ? heureTexte(heures[i]) : "—"}</div>
        </div>

        <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/15 text-xs">
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
