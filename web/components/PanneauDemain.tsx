"use client";

import { useEffect, useState } from "react";
import { lire, type Creneau, type Prevision, type Scenario } from "@/lib/api";
import { couleurCo2, gw, jourTexte } from "@/lib/visuel";

const h = (iso: string) => Number(iso.slice(11, 13));

/** Prévision J+1 de notre modèle : barres = consommation, couleur = intensité carbone ; meilleur créneau encadré. */
export default function PanneauDemain() {
  const [prev, setPrev] = useState<Prevision | null>(null);
  const [duree, setDuree] = useState(3);
  const [creneau, setCreneau] = useState<Creneau | null>(null);
  const [delta, setDelta] = useState(-5);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    lire<Prevision>("/prevision").then(setPrev).catch((e) => setErreur(String(e)));
  }, []);
  useEffect(() => {
    lire<Creneau>(`/meilleur-creneau?duree_h=${duree}`).then(setCreneau).catch(() => setCreneau(null));
  }, [duree]);
  useEffect(() => {
    const id = setTimeout(() => lire<Scenario>(`/scenario/froid?delta_c=${delta}`).then(setScenario).catch(() => setScenario(null)), 250);
    return () => clearTimeout(id);
  }, [delta]);

  if (erreur) return <div className="panneau w-full md:w-[340px] p-5 text-xs text-amber-300">Prévision indisponible : l&apos;API tourne-t-elle ? ({erreur.slice(0, 120)})</div>;
  if (!prev) return <div className="panneau w-full md:w-[340px] p-5 text-sm text-slate-400">Prévision en cours…</div>;

  const heures = prev.heures;
  const maxi = Math.max(...heures.map((x) => x.consommation_mw));
  const mini = Math.min(...heures.map((x) => x.consommation_mw)) * 0.9;
  const [d, f] = creneau ? [h(creneau.debut), h(creneau.fin) || 24] : [-1, -1];

  return (
    <div className="panneau w-full md:w-[340px] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">Demain, selon notre modèle</div>
      <div className="mt-0.5 text-xs capitalize text-slate-400">{jourTexte(prev.jour)}</div>

      <div className="relative mt-3 flex h-28 items-end gap-[3px]">
        {heures.map((x, k) => (
          <div
            key={x.heure_locale}
            className="flex-1 rounded-t-sm"
            title={`${h(x.heure_locale)} h : ${gw(x.consommation_mw)} GW, ${x.taux_co2_g_kwh} g/kWh`}
            style={{
              height: `${((x.consommation_mw - mini) / (maxi - mini)) * 100}%`,
              background: couleurCo2(x.taux_co2_g_kwh),
              opacity: k >= d && k < f ? 1 : 0.55,
              boxShadow: k >= d && k < f ? "0 0 12px rgba(52,211,153,0.6)" : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
      <div className="mt-1 text-[11px] text-slate-400">
        Pointe {gw(maxi)} GW · CO₂ de {Math.min(...heures.map((x) => x.taux_co2_g_kwh))} à {Math.max(...heures.map((x) => x.taux_co2_g_kwh))} g/kWh
      </div>

      <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Meilleur créneau pour consommer</span>
          <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} className="rounded-md border border-white/15 bg-slate-900 px-1.5 py-0.5 text-xs">
            {[1, 2, 3, 4, 6, 8].map((x) => <option key={x} value={x}>{x} h</option>)}
          </select>
        </div>
        {creneau ? (
          <div className="mt-1">
            <div className="text-xl font-semibold text-emerald-300">de {h(creneau.debut)} h à {h(creneau.fin) || 24} h</div>
            <div className="text-[11px] text-slate-400">
              {creneau.taux_co2_moyen_g_kwh} g/kWh, soit −{creneau.economie_vs_pire_pct} % de CO₂ par rapport au pire créneau
            </div>
          </div>
        ) : <div className="mt-1 text-xs text-slate-500">indisponible</div>}
      </div>

      <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Et si demain était plus froid ?</span>
          <span className="tabular-nums text-sky-200">{delta > 0 ? "+" : ""}{delta} °C</span>
        </div>
        <input type="range" min={-10} max={5} step={1} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="frise mt-2 w-full" aria-label="Écart de température" />
        {scenario && (
          <div className="mt-1 text-[11px] text-slate-400">
            Notre modèle prévoit <span className="font-semibold text-sky-200">{scenario.ecart_moyen_mw >= 0 ? "+" : "−"}{gw(Math.abs(scenario.ecart_moyen_mw))} GW</span> en moyenne,
            jusqu&apos;à <span className="font-semibold text-sky-200">{scenario.ecart_max_mw >= 0 ? "+" : "−"}{gw(Math.abs(scenario.ecart_max_mw))} GW</span> à l&apos;heure la plus touchée.
          </div>
        )}
      </div>
      <div className="mt-2 text-[10px] text-slate-500">LightGBM · versions {Object.values(prev.versions_modeles).join(" / ")} · météo prévue Open-Meteo</div>
    </div>
  );
}
