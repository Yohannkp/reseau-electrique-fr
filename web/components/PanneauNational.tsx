"use client";

import type { DonneesNational } from "@/lib/api";
import { couleurCo2, gw } from "@/lib/visuel";

const MIX: { cle: keyof DonneesNational["mix"]; nom: string; couleur: string }[] = [
  { cle: "nucleaire", nom: "Nucléaire", couleur: "rgb(244,190,32)" },
  { cle: "hydraulique", nom: "Hydraulique", couleur: "rgb(56,132,230)" },
  { cle: "eolien", nom: "Éolien", couleur: "rgb(116,220,196)" },
  { cle: "solaire", nom: "Solaire", couleur: "rgb(255,132,36)" },
  { cle: "bioenergies", nom: "Bioénergies", couleur: "rgb(60,170,110)" },
  { cle: "gaz", nom: "Gaz", couleur: "rgb(232,64,64)" },
  { cle: "charbon", nom: "Charbon", couleur: "rgb(120,90,80)" },
  { cle: "fioul", nom: "Fioul", couleur: "rgb(150,100,190)" },
];

function Courbe({ n, i }: { n: DonneesNational; i: number }) {
  const conso = n.consommation_mw.map((x) => x ?? NaN);
  const prev = n.prevision_j1_mw.map((x) => x ?? NaN);
  const toutes = [...conso, ...prev].filter((x) => !Number.isNaN(x));
  if (toutes.length < 2) return null;
  const [bas, haut] = [Math.min(...toutes) * 0.97, Math.max(...toutes) * 1.02];
  const L = 280, H = 70, nb = Math.max(1, conso.length - 1);
  const pt = (k: number, y: number) => `${(k / nb) * L},${H - ((y - bas) / (haut - bas)) * H}`;
  const trace = (s: number[]) =>
    s.map((y, k) => (Number.isNaN(y) ? null : pt(k, y))).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${L} ${H + 4}`} className="mt-2 w-full" aria-label="Consommation de la journée">
      <defs>
        <linearGradient id="aire" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(56,189,248)" stopOpacity="0.35" />
          <stop offset="1" stopColor="rgb(56,189,248)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${trace(conso)} ${((conso.length - 1) / nb) * L},${H}`} fill="url(#aire)" />
      <polyline points={trace(prev)} fill="none" stroke="rgb(148,163,184)" strokeWidth="1.2" strokeDasharray="3 3" />
      <polyline points={trace(conso)} fill="none" stroke="rgb(125,211,252)" strokeWidth="2" strokeLinejoin="round" />
      <line x1={(i / nb) * L} x2={(i / nb) * L} y1="0" y2={H} stroke="white" strokeOpacity="0.7" strokeWidth="1" />
    </svg>
  );
}

export default function PanneauNational({ n, i }: { n: DonneesNational | null; i: number }) {
  if (!n) return <div className="panneau w-[330px] p-5 text-sm text-slate-400">Chargement…</div>;
  const conso = n.consommation_mw[i];
  const prev = n.prevision_j1_mw[i];
  const co2 = n.taux_co2_g_kwh[i];
  const bas = n.part_bas_carbone[i];
  const solde = Object.values(n.echanges).reduce((s, x) => s + (x[i] ?? 0), 0);
  const mix = MIX.map((m) => ({ ...m, mw: n.mix[m.cle][i] ?? 0 })).filter((m) => m.mw > 0);
  const total = mix.reduce((s, m) => s + m.mw, 0);

  return (
    <div className="panneau w-[330px] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">France, à cette heure</div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <div className="text-xs text-slate-400">Consommation</div>
          <div className="text-3xl font-semibold tabular-nums text-white">{gw(conso)}<span className="ml-1 text-base text-slate-400">GW</span></div>
          <div className="text-[11px] text-slate-500">prévue par RTE la veille : {gw(prev)} GW</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Intensité carbone</div>
          <div className="text-3xl font-semibold tabular-nums" style={{ color: co2 != null ? couleurCo2(co2) : undefined }}>
            {co2 ?? "—"}<span className="ml-1 text-base text-slate-400">g/kWh</span>
          </div>
          <div className="text-[11px] text-slate-500">{bas != null ? `${Math.round(bas * 100)} % bas carbone` : ""}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-slate-400">Échanges avec les voisins</div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: solde >= 0 ? "rgb(64,224,255)" : "rgb(255,150,60)" }}>
            {solde >= 0 ? "La France exporte" : "La France importe"} {gw(Math.abs(solde))} GW
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
          {mix.map((m) => <div key={m.cle} style={{ width: `${(m.mw / total) * 100}%`, background: m.couleur }} title={`${m.nom} : ${gw(m.mw)} GW`} />)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
          {mix.slice(0, 6).map((m) => (
            <div key={m.cle} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: m.couleur }} />
              {m.nom}<span className="ml-auto tabular-nums text-slate-400">{gw(m.mw)} GW</span>
            </div>
          ))}
        </div>
      </div>

      <Courbe n={n} i={i} />
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span><span className="text-sky-300">━</span> réel</span>
        <span>┄ prévision RTE de la veille</span>
      </div>
    </div>
  );
}
