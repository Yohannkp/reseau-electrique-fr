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
}

function decaler(jour: string, n: number) {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Frise({ jour, periode, heures, i, lecture, vitesse, journees, onJour, onI, onLecture, onVitesse }: Props) {
  const max = Math.max(0, heures.length - 1);
  return (
    <div className="panneau pointer-events-auto w-full px-5 pt-3 pb-4">
      <div className="mb-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">Machine à remonter le temps</span>
        {journees.map((j) => (
          <button
            key={j.date + j.titre}
            onClick={() => onJour(j.date)}
            title={`${j.description} (${j.valeur})`}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              j.date === jour ? "border-sky-300 bg-sky-300/20 text-white" : "border-white/15 text-slate-300 hover:border-white/40 hover:text-white"
            }`}
          >
            {j.titre}
          </button>
        ))}
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
