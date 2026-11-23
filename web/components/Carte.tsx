"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { AmbientLight, DirectionalLight, LightingEffect, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { Map } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE, type DonneesNational, type DonneesRegions, type Voisin } from "@/lib/api";
import { arc, couleurSocle, couleurSolde, EXPORT, FILIERES, gw, IMPORT, INTERCONNEXIONS, M_PAR_MW, M_TOUR_PAR_MW, type RGB } from "@/lib/visuel";

// Le worker de MapLibre est servi depuis public/ (copié par predev) : le bundler ne sait pas l'empaqueter.
setWorkerUrl(`${BASE}/maplibre-gl-worker.mjs`);

const FOND = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";
const VUE_INITIALE: MapViewState = { longitude: 2.3, latitude: 45.75, zoom: 5.22, pitch: 52, bearing: -14 };

// Lumière rasante venue du sud-ouest, comme un soleil de fin d'après-midi : les reliefs se lisent par leurs ombres.
const LUMIERE = new LightingEffect({
  ambiante: new AmbientLight({ color: [255, 255, 255], intensity: 0.85 }),
  soleil: new DirectionalLight({ color: [255, 236, 210], intensity: 1.6, direction: [-3, -8, -4] }),
  contre: new DirectionalLight({ color: [120, 170, 255], intensity: 0.6, direction: [4, 6, -2] }),
});

// Murs éclairés de façon diffuse : un reflet spéculaire ferait scintiller chaque facette du contour.
const MATERIAU = { ambient: 0.62, diffuse: 0.45, shininess: 6, specularColor: [25, 28, 35] as RGB };

type Region = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { code: string; nom: string; centre: [number, number] }>;

export interface Survol {
  x: number;
  y: number;
  code: string;
  nom: string;
}

interface Props {
  geo: GeoJSON.FeatureCollection | null;
  regions: DonneesRegions | null;
  national: DonneesNational | null;
  i: number;
  rotation: boolean;
  onSurvol: (s: Survol | null) => void;
}

export default function Carte({ geo, regions, national, i, rotation, onSurvol }: Props) {
  const [vue, setVue] = useState<MapViewState>(VUE_INITIALE);
  const [t, setT] = useState(0);
  const phase = useRef(0);
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // Une seule boucle d'animation : impulsions des échanges et lente rotation de la caméra pendant la lecture.
  useEffect(() => {
    let id = 0;
    let avant = performance.now();
    const boucle = (maintenant: number) => {
      const dt = (maintenant - avant) / 1000;
      avant = maintenant;
      setT((x) => (x + dt * 0.45) % 1);
      // pendant la lecture, la caméra se balance doucement autour de la vue de départ, sans jamais désorienter
      if (rotationRef.current) {
        phase.current += dt * 0.18;
        setVue((v) => ({ ...v, bearing: (VUE_INITIALE.bearing ?? 0) + 14 * Math.sin(phase.current) }));
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, []);

  const v = (code: string, cle: string) => regions?.valeurs[code]?.[cle as keyof DonneesRegions["valeurs"][string]]?.[i] ?? null;

  // Tours de production : les filières empilées sur le toit de chaque région.
  const tours = useMemo(() => {
    if (!geo || !regions) return [];
    const blocs: { position: [number, number, number]; hauteur: number; couleur: RGB; region: string }[] = [];
    const ESPACE = 1800; // un joint entre deux filières : on lit les segments sans effort
    for (const f of geo.features as Region[]) {
      const { code, centre } = f.properties;
      const valeurs = regions.valeurs[code];
      if (!valeurs) continue;
      let z = (valeurs.consommation_mw[i] ?? 0) * M_PAR_MW + 4000;
      for (const fil of FILIERES) {
        const mw = valeurs[`${fil.cle}_mw`][i] ?? 0;
        if (mw < 30) continue;
        blocs.push({ position: [centre[0], centre[1], z], hauteur: mw * M_TOUR_PAR_MW, couleur: fil.couleur, region: code });
        z += mw * M_TOUR_PAR_MW + ESPACE;
      }
    }
    return blocs;
  }, [geo, regions, i]);

  // Contours des toits : un liseré lumineux à la hauteur de chaque socle, teinté par le solde.
  const anneaux = useMemo(() => {
    if (!geo) return [];
    return (geo.features as Region[]).flatMap((f) => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      return polys.map((p) => ({ code: f.properties.code, anneau: p[0] as [number, number][] }));
    });
  }, [geo]);

  const pieds = useMemo(() => {
    if (!geo || !regions) return [];
    return (geo.features as Region[])
      .filter((f) => regions.valeurs[f.properties.code])
      .map((f) => ({
        position: [...f.properties.centre, (regions.valeurs[f.properties.code].consommation_mw[i] ?? 0) * M_PAR_MW + 300] as [number, number, number],
      }));
  }, [geo, regions, i]);

  // Échanges : un arc par frontière, des impulsions qui partent de l'exportateur.
  const echanges = useMemo(() => {
    if (!national) return [];
    return (Object.keys(INTERCONNEXIONS) as Voisin[]).map((cle) => {
      const mw = national.echanges[cle]?.[i] ?? 0;
      const { france, voisin, nom } = INTERCONNEXIONS[cle];
      const chemin = mw >= 0 ? arc(france, voisin) : arc(voisin, france);
      return { cle, nom, mw, chemin, couleur: mw >= 0 ? EXPORT : IMPORT, label: voisin };
    });
  }, [national, i]);

  const impulsions = useMemo(
    () =>
      echanges
        .filter((e) => Math.abs(e.mw) > 50)
        .flatMap((e) =>
          [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3].map((phase) => ({
            ...e,
            temps: e.chemin.map((_, k) => k / (e.chemin.length - 1) + phase),
          })),
        ),
    [echanges],
  );

  const hauteurSocle = (code: string) => ((v(code, "consommation_mw") as number) ?? 0) * M_PAR_MW;

  const couches = [
    new GeoJsonLayer<Region["properties"]>({
      id: "regions",
      data: geo ?? undefined,
      extruded: true,
      pickable: true,
      getElevation: (f) => hauteurSocle(f.properties.code),
      getFillColor: (f) =>
        f.properties.code === "94"
          ? [22, 26, 36, 255] // Corse : hors du périmètre d'éCO2mix régional
          : [...couleurSocle(v(f.properties.code, "solde_mw"), v(f.properties.code, "consommation_mw")), 255], // opaque : sinon on voit les murs des voisines à travers
      material: MATERIAU,
      transitions: { getElevation: 350, getFillColor: 350 },
      updateTriggers: { getElevation: [regions, i], getFillColor: [regions, i] },
      onHover: (info: PickingInfo<Region>) =>
        onSurvol(info.object ? { x: info.x, y: info.y, code: info.object.properties.code, nom: info.object.properties.nom } : null),
    }),
    new PathLayer<(typeof anneaux)[number]>({
      id: "liseres",
      data: anneaux,
      getPath: (d) => d.anneau.map(([x, y]) => [x, y, hauteurSocle(d.code) + 150] as [number, number, number]),
      getColor: (d) => (d.code === "94" ? [90, 100, 120, 90] : [...couleurSolde(v(d.code, "solde_mw"), v(d.code, "consommation_mw")), 230]),
      getWidth: 1.6,
      widthUnits: "pixels",
      jointRounded: true,
      transitions: { getPath: 350, getColor: 350 },
      updateTriggers: { getPath: [regions, i], getColor: [regions, i] },
    }),
    // ombre douce au pied des tours : elles paraissent posées sur le toit, pas collées dessus
    new ScatterplotLayer<(typeof pieds)[number]>({
      id: "ombres",
      data: pieds,
      getPosition: (d) => d.position,
      getRadius: 30000,
      getFillColor: [0, 0, 0, 120],
      transitions: { getPosition: 350 },
    }),
    new ColumnLayer<(typeof tours)[number]>({
      id: "tours",
      data: tours,
      diskResolution: 6, // prismes hexagonaux
      radius: 19000,
      angle: 30,
      extruded: true,
      getPosition: (d) => d.position,
      getElevation: (d) => d.hauteur,
      getFillColor: (d) => [...d.couleur, 255],
      material: { ambient: 0.55, diffuse: 0.7, shininess: 60, specularColor: [200, 200, 200] },
      transitions: { getElevation: 350, getPosition: 350 },
    }),
    // arcs : un halo large et doux sous un trait fin, puis des impulsions lumineuses dans le sens du flux
    new PathLayer<(typeof echanges)[number]>({
      id: "arcs-halo",
      data: echanges,
      getPath: (d) => d.chemin,
      getColor: (d) => [...d.couleur, 28],
      getWidth: (d) => 10 + Math.abs(d.mw) / 250,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
    }),
    new PathLayer<(typeof echanges)[number]>({
      id: "arcs",
      data: echanges,
      getPath: (d) => d.chemin,
      getColor: (d) => [...d.couleur, 120],
      getWidth: (d) => 1.5 + Math.abs(d.mw) / 1200,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
    }),
    new TripsLayer<(typeof impulsions)[number]>({
      id: "impulsions-halo",
      data: impulsions,
      getPath: (d) => d.chemin,
      getTimestamps: (d) => d.temps,
      getColor: (d) => [...d.couleur, 90],
      getWidth: (d) => 9 + Math.abs(d.mw) / 220,
      widthUnits: "pixels",
      capRounded: true,
      trailLength: 0.25,
      currentTime: t,
      fadeTrail: true,
    }),
    new TripsLayer<(typeof impulsions)[number]>({
      id: "impulsions",
      data: impulsions,
      getPath: (d) => d.chemin,
      getTimestamps: (d) => d.temps,
      getColor: (d) => [...d.couleur.map((c) => Math.min(255, c + 60)), 255] as [number, number, number, number],
      getWidth: (d) => 2.5 + Math.abs(d.mw) / 700,
      widthUnits: "pixels",
      capRounded: true,
      trailLength: 0.18,
      currentTime: t,
      fadeTrail: true,
    }),
    new TextLayer<(typeof echanges)[number]>({
      id: "voisins",
      data: echanges,
      getPosition: (d) => [...INTERCONNEXIONS[d.cle].etiquette, 0],
      getText: (d) => `${d.nom}\n${d.mw >= 0 ? "export" : "import"} ${gw(Math.abs(d.mw))} GW`,
      getColor: (d) => [...d.couleur, 255],
      getSize: 14,
      characterSet: "auto", // sinon « · » et les accents manquent dans l'atlas de la police
      background: true,
      getBackgroundColor: [8, 12, 22, 215],
      getBorderColor: (d) => [...d.couleur, 90],
      getBorderWidth: 1,
      backgroundBorderRadius: 10,
      backgroundPadding: [10, 6],
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 600,
      lineHeight: 1.3,
      billboard: true,
      parameters: { depthCompare: "always" }, // toujours lisibles, jamais mangées par la géométrie
      updateTriggers: { getText: [i, national], getColor: [i, national], getBorderColor: [i, national] },
    }),
  ];

  return (
    <DeckGL
      viewState={vue}
      onViewStateChange={({ viewState }) => setVue(viewState as MapViewState)}
      controller={{ dragRotate: true, touchRotate: true }}
      layers={couches}
      effects={[LUMIERE]}
    >
      <Map mapStyle={FOND} reuseMaps attributionControl={{ compact: true }} />
    </DeckGL>
  );
}
