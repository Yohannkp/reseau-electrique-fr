// Palette, échelles et géométrie de la carte. Couleurs des filières proches de celles d'éCO2mix.

import type { Filiere, Voisin } from "./api";

export type RGB = [number, number, number];

export const FILIERES: { cle: Filiere; nom: string; couleur: RGB }[] = [
  { cle: "nucleaire", nom: "Nucléaire", couleur: [244, 190, 32] },
  { cle: "hydraulique", nom: "Hydraulique", couleur: [56, 132, 230] },
  { cle: "eolien", nom: "Éolien", couleur: [116, 220, 196] },
  { cle: "solaire", nom: "Solaire", couleur: [255, 132, 36] },
  { cle: "thermique", nom: "Thermique fossile", couleur: [232, 64, 64] },
  { cle: "bioenergies", nom: "Bioénergies", couleur: [60, 170, 110] },
];

export const EXPORT: RGB = [64, 224, 255]; // la région ou la France donne de l'électricité
export const IMPORT: RGB = [255, 150, 60]; // elle en reçoit
const NEUTRE: RGB = [70, 82, 110];

/** Mètres de hauteur par MW : l'Île-de-France (~10 GW en hiver) monte à ~220 km, lisible à l'échelle du pays. */
export const M_PAR_MW = 22;

/** Les tours montent moins vite que les socles (×0,62) : sinon le nord devient une forêt de pailles. */
export const M_TOUR_PAR_MW = M_PAR_MW * 0.62;

function melange(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

/** Teinte du solde : cyan si la région produit plus qu'elle ne consomme, ambre sinon. Sert au liseré du toit. */
export function couleurSolde(solde: number | null, conso: number | null): RGB {
  if (solde == null || !conso) return NEUTRE;
  const t = Math.max(-1, Math.min(1, solde / conso)); // solde relatif à la consommation
  return t >= 0 ? melange(NEUTRE, EXPORT, Math.min(1, 0.35 + t)) : melange(NEUTRE, IMPORT, Math.min(1, 0.35 - t * 1.4));
}

/** Socle anthracite, à peine teinté par le solde : la couleur vive est réservée aux tours et aux arcs. */
export function couleurSocle(solde: number | null, conso: number | null): RGB {
  return melange([26, 32, 46], couleurSolde(solde, conso), 0.16);
}

/** Couleur d'un taux de CO2 : vert sous 20 g/kWh, rouge au-dessus de 80. */
export function couleurCo2(g: number): string {
  const t = Math.max(0, Math.min(1, (g - 15) / 65));
  const c = t < 0.5 ? melange([52, 211, 153], [250, 204, 21], t * 2) : melange([250, 204, 21], [239, 68, 68], (t - 0.5) * 2);
  return `rgb(${c.join(",")})`;
}

/** Interconnexions : point de départ côté français et point d'arrivée chez le voisin. */
/** Interconnexions : départ côté français, arrivée chez le voisin, et étiquette posée au large, hors de la France. */
export const INTERCONNEXIONS: Record<Voisin, { nom: string; france: [number, number]; voisin: [number, number]; etiquette: [number, number] }> = {
  angleterre: { nom: "Grande-Bretagne", france: [1.85, 50.95], voisin: [-0.4, 51.9], etiquette: [-3.4, 53.3] },
  allemagne_belgique: { nom: "Allemagne · Belgique", france: [6.2, 49.2], voisin: [7.6, 51.0], etiquette: [8.6, 51.7] },
  suisse: { nom: "Suisse", france: [6.4, 46.6], voisin: [8.2, 47.2], etiquette: [8.9, 48.1] },
  italie: { nom: "Italie", france: [6.6, 45.2], voisin: [8.9, 45.2], etiquette: [9.6, 44.3] },
  espagne: { nom: "Espagne", france: [2.6, 42.8], voisin: [1.0, 41.1], etiquette: [-0.8, 40.5] },
};

/** Arc 3D entre deux points : une parabole dont la hauteur grandit avec la distance. */
export function arc(de: [number, number], vers: [number, number], n = 48): [number, number, number][] {
  const distKm = Math.hypot((vers[0] - de[0]) * 73, (vers[1] - de[1]) * 111);
  const hauteur = 160000 + distKm * 500; // au-dessus des socles régionaux (jusqu'à ~220 km)
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [de[0] + (vers[0] - de[0]) * t, de[1] + (vers[1] - de[1]) * t, Math.sin(Math.PI * t) * hauteur];
  });
}

export const gw = (mw: number | null | undefined, d = 1) => (mw == null ? "—" : (mw / 1000).toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d }));

export function heureTexte(iso: string) {
  return `${Number(iso.slice(11, 13))} h`;
}

export function jourTexte(iso: string) {
  return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
