"use client";

import { useEffect, useState } from "react";
import { lire, type Pipeline } from "@/lib/api";

const pastille = (ok: boolean, alerte = false) =>
  `inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)]" : alerte ? "bg-amber-400" : "bg-rose-500 shadow-[0_0_8px_rgb(244,63,94)]"}`;

function duree(s: number | null) {
  if (s == null) return "—";
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.round(s / 60)} min`;
}

/** Le pipeline vu de l'intérieur : fraîcheur, tests dbt, DAG Airflow, modèles. Rafraîchi toutes les 30 s. */
export default function ModeIngenieur({ onFermer }: { onFermer: () => void }) {
  const [p, setP] = useState<Pipeline | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const charger = () => lire<Pipeline>("/pipeline").then((x) => { setP(x); setErreur(null); }).catch((e) => setErreur(String(e)));
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="panneau pointer-events-auto fixed inset-x-2 bottom-2 top-[calc(max(12px,env(safe-area-inset-top))+44px)] z-50 overflow-y-auto overscroll-contain p-4 font-mono text-[12px] md:absolute md:inset-x-auto md:right-6 md:top-20 md:bottom-[150px] md:w-[420px] md:p-5">
      <div className="flex items-center justify-between">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/90">Mode ingénieur</div>
        <button onClick={onFermer} className="text-slate-400 hover:text-white" aria-label="Fermer">✕</button>
      </div>
      {erreur && <div className="mt-3 text-amber-300">/pipeline indisponible : {erreur.slice(0, 160)}</div>}
      {!p && !erreur && <div className="mt-3 text-slate-400">Chargement…</div>}
      {p && (
        <div className="mt-3 space-y-5">
          <section>
            <h3 className="mb-1.5 font-sans text-xs text-slate-400">Fraîcheur des sources</h3>
            {p.fraicheur.map((f) => (
              <div key={f.source} className="flex items-center gap-2 py-0.5">
                <span className={pastille(f.retard_min < 120, f.retard_min < 240)} />
                <span className="text-slate-200">{f.source}</span>
                <span className="ml-auto text-slate-400">{f.derniere_donnee.slice(5, 16).replace("T", " ")} · {f.retard_min} min</span>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-1.5 font-sans text-xs text-slate-400">Qualité des données (dbt)</h3>
            <div className="flex gap-3">
              <span className="text-emerald-300">{p.dbt.reussis} réussis</span>
              <span className="text-amber-300">{p.dbt.avertissements} avert.</span>
              <span className={p.dbt.echecs ? "text-rose-400" : "text-slate-500"}>{p.dbt.echecs} échecs</span>
              <span className="ml-auto text-slate-400">{p.dbt.date?.slice(11, 16) ?? "—"} · {duree(p.dbt.duree_s)}</span>
            </div>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg bg-black/30 p-2">
              {[...p.dbt.resultats].sort((a, b) => (a.statut === "pass" ? 1 : 0) - (b.statut === "pass" ? 1 : 0)).map((r) => (
                <div key={r.nom} className="flex gap-2 py-px">
                  <span className={r.statut === "pass" || r.statut === "success" ? "text-emerald-400" : r.statut === "warn" ? "text-amber-300" : "text-rose-400"}>{r.statut}</span>
                  <span className="truncate text-slate-300" title={r.nom}>{r.nom}</span>
                  <span className="ml-auto text-slate-500">{r.duree_s.toFixed(2)}s</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 font-sans text-xs text-slate-400">Orchestration ({p.orchestrateur ?? "Airflow"})</h3>
            {p.airflow.length === 0 && <div className="text-slate-500">{p.orchestrateur ? "aucune étape mesurée" : "Airflow injoignable"}</div>}
            {p.airflow.map((d) => (
              <div key={d.dag} className="flex items-center gap-2 py-0.5">
                <span className={pastille(d.etat === "success", d.etat === "running" || d.etat === "queued")} />
                <span className="text-slate-200">{d.dag}</span>
                <span className="ml-auto text-slate-400">{d.etat ?? "jamais"} · {d.derniere_execution?.slice(5, 16).replace("T", " ") ?? ""} · {duree(d.duree_s)}</span>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-1.5 font-sans text-xs text-slate-400">Modèles en production (MLflow)</h3>
            {p.modeles.map((m) => (
              <div key={m.nom} className="flex gap-2 py-0.5">
                <span className="text-sky-300">{m.nom}</span>
                <span className="text-slate-400">v{m.version}</span>
                <span className="ml-auto text-slate-300">{m.erreur_test}</span>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-1.5 font-sans text-xs text-slate-400">Volumes exportés</h3>
            {p.volumes.map((v) => (
              <div key={v.table} className="flex py-px">
                <span className="text-slate-300">{v.table}</span>
                <span className="ml-auto tabular-nums text-slate-400">{v.lignes.toLocaleString("fr-FR")} lignes</span>
              </div>
            ))}
          </section>
          <div className="text-[10px] text-slate-600">généré à {p.genere_a.slice(11, 19)}</div>
        </div>
      )}
    </aside>
  );
}
