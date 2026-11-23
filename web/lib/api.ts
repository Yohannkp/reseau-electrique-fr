// Accès à l'API FastAPI du projet (src/api). Les formes ci-dessous suivent le contrat des endpoints.

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18000";

export async function lire<T>(chemin: string): Promise<T> {
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
}
