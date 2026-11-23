// Accès à l'API FastAPI du projet (src/api). Les formes ci-dessous suivent le contrat des endpoints.

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18000";
/** Version en ligne : pas d'API, des fichiers JSON publiés chaque heure par GitHub Actions (src/publication). */
export const STATIQUE = process.env.NEXT_PUBLIC_STATIQUE === "1";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Fichier publié qui contient la réponse d'un appel de l'API, et la clé à y lire si le fichier en regroupe plusieurs. */
function fichierStatique(chemin: string): [string, string | null] {
  const u = new URL(chemin, "http://x");
  const q = (n: string) => u.searchParams.get(n) ?? "";
  switch (u.pathname) {
    case "/periode": return ["periode.json", null];
    case "/journees-remarquables": return ["journees.json", null];
    case "/carte/regions": return [`regions/${q("debut")}.json`, null];
    case "/carte/national": return [`national/${q("debut")}.json`, null];
    case "/prevision": return ["prevision.json", null];
    case "/meilleur-creneau": return ["creneaux.json", String(Number(q("duree_h")))];
    case "/scenario/froid": return ["scenarios.json", String(Number(q("delta_c")))];
    case "/pipeline": return ["pipeline.json", null];
    default: throw new Error(`${u.pathname} n'est pas publié dans la version en ligne`);
  }
}

export async function lire<T>(chemin: string): Promise<T> {
  if (STATIQUE) {
    const [fichier, cle] = fichierStatique(chemin);
    const r = await fetch(`${BASE}/data/${fichier}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`${fichier} : non publié dans la version en ligne`);
    const json = await r.json();
    return cle === null ? json : json[cle];
  }
  const r = await fetch(API + chemin, { cache: "no-store" });
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${await r.text()}`);
  return r.json();
}

type Serie = (number | null)[];

export type Filiere = "nucleaire" | "hydraulique" | "eolien" | "solaire" | "thermique" | "bioenergies";

export interface DonneesRegions {
  heures: string[];
  regions: { code: string; nom: string; latitude: number; longitude: number }[];
  valeurs: Record<string, Record<`${Filiere}_mw` | "consommation_mw" | "production_mw" | "solde_mw" | "temperature_c", Serie>>;
}

export type Voisin = "angleterre" | "espagne" | "italie" | "suisse" | "allemagne_belgique";

export interface DonneesNational {
  heures: string[];
  consommation_mw: Serie;
  prevision_j1_mw: Serie;
  taux_co2_g_kwh: Serie;
  part_bas_carbone: Serie;
  mix: Record<"nucleaire" | "hydraulique" | "eolien" | "solaire" | "bioenergies" | "gaz" | "charbon" | "fioul", Serie>;
  /** MW, positif = la France exporte vers ce voisin */
  echanges: Record<Voisin, Serie>;
}

export interface Journee {
  date: string;
  titre: string;
  description: string;
  valeur: string;
}

export interface Prevision {
  jour: string;
  versions_modeles: Record<string, string>;
  donnees_completes: boolean;
  heures: { heure_locale: string; consommation_mw: number; taux_co2_g_kwh: number }[];
}

export interface Creneau {
  debut: string;
  fin: string;
  taux_co2_moyen_g_kwh: number;
  pire_creneau_g_kwh: number;
  economie_vs_pire_pct: number;
  economie_vs_moyenne_pct: number;
}

export interface Scenario {
  jour: string;
  delta_c: number;
  heures: string[];
  reference_mw: number[];
  scenario_mw: number[];
  ecart_max_mw: number;
  ecart_moyen_mw: number;
}

export interface Pipeline {
  genere_a: string;
  fraicheur: { source: string; derniere_donnee: string; retard_min: number }[];
  volumes: { table: string; lignes: number }[];
  dbt: {
    date: string | null;
    duree_s: number | null;
    tests: number;
    reussis: number;
    avertissements: number;
    echecs: number;
    resultats: { nom: string; statut: string; duree_s: number }[];
  };
  airflow: { dag: string; derniere_execution: string | null; etat: string | null; duree_s: number | null }[];
  modeles: { nom: string; version: string; erreur_test: string }[];
  /** version en ligne : ce qui orchestre la publication à la place d'Airflow */
  orchestrateur?: string;
}
