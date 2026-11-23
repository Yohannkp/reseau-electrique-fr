"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { AmbientLight, DirectionalLight, LightingEffect, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { Map } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DonneesNational, DonneesRegions, Voisin } from "@/lib/api";
import { arc, couleurSolde, EXPORT, FILIERES, gw, IMPORT, INTERCONNEXIONS, M_PAR_MW, type RGB } from "@/lib/visuel";

// Le worker de MapLibre est servi depuis public/ (copié par predev) : le bundler ne sait pas l'empaqueter.
setWorkerUrl("/maplibre-gl-worker.mjs");

const FOND = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";
const VUE_INITIALE: MapViewState = { longitude: 2.2, latitude: 45.6, zoom: 5.05, pitch: 52, bearing: -14 };

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
    for (const f of geo.features as Region[]) {
      const { code, centre } = f.properties;
      const valeurs = regions.valeurs[code];
      if (!valeurs) continue;
      let z = (valeurs.consommation_mw[i] ?? 0) * M_PAR_MW + 4000;
      for (const fil of FILIERES) {
        const mw = valeurs[`${fil.cle}_mw`][i] ?? 0;
        if (mw < 30) continue;
        blocs.push({ position: [centre[0], centre[1], z], hauteur: mw * M_PAR_MW, couleur: fil.couleur, region: code });
        z += mw * M_PAR_MW;
      }
    }
    return blocs;
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

  const couches = [
    new GeoJsonLayer<Region["properties"]>({
      id: "regions",
      data: geo ?? undefined,
      extruded: true,
      pickable: true,
      stroked: true,
      getElevation: (f) => ((v(f.properties.code, "consommation_mw") as number) ?? 0) * M_PAR_MW,
      getFillColor: (f) =>
        f.properties.code === "94"
          ? [40, 46, 60, 180] // Corse : hors du périmètre d'éCO2mix régional
          : [...couleurSolde(v(f.properties.code, "solde_mw"), v(f.properties.code, "consommation_mw")), 255], // opaque : sinon on voit les murs des voisines à travers
      getLineColor: [255, 255, 255, 60],
      lineWidthMinPixels: 1,
      material: MATERIAU,
      transitions: { getElevation: 350, getFillColor: 350 },
      updateTriggers: { getElevation: [regions, i], getFillColor: [regions, i] },
      onHover: (info: PickingInfo<Region>) =>
        onSurvol(info.object ? { x: info.x, y: info.y, code: info.object.properties.code, nom: info.object.properties.nom } : null),
    }),
    new ColumnLayer<(typeof tours)[number]>({
      id: "tours",
      data: tours,
      diskResolution: 24,
      radius: 14000,
      extruded: true,
      getPosition: (d) => d.position,
      getElevation: (d) => d.hauteur,
      getFillColor: (d) => [...d.couleur, 245],
      material: { ambient: 0.6, diffuse: 0.6, shininess: 90, specularColor: [255, 255, 255] },
      transitions: { getElevation: 350, getPosition: 350 },
    }),
    new PathLayer<(typeof echanges)[number]>({
      id: "arcs",
      data: echanges,
      getPath: (d) => d.chemin,
      getColor: (d) => [...d.couleur, 70],
      getWidth: (d) => 2 + Math.abs(d.mw) / 600,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
    }),
    new TripsLayer<(typeof impulsions)[number]>({
      id: "impulsions",
      data: impulsions,
      getPath: (d) => d.chemin,
      getTimestamps: (d) => d.temps,
      getColor: (d) => d.couleur,
      getWidth: (d) => 3 + Math.abs(d.mw) / 450,
      widthUnits: "pixels",
      capRounded: true,
      trailLength: 0.22,
      currentTime: t,
      fadeTrail: true,
    }),
    new TextLayer<(typeof echanges)[number]>({
      id: "voisins",
      data: echanges,
      getPosition: (d) => [...INTERCONNEXIONS[d.cle].voisin, 4000],
      getText: (d) => `${d.nom}\n${d.mw >= 0 ? "export" : "import"} ${gw(Math.abs(d.mw))} GW`,
      getColor: (d) => [...d.couleur, 235],
      getSize: 15,
      background: true,
      getBackgroundColor: [5, 8, 16, 190],
      backgroundPadding: [8, 5],
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 600,
      lineHeight: 1.25,
      fontSettings: { sdf: true },
      billboard: true,
      parameters: { depthCompare: "always" }, // toujours lisibles, même derrière une tour
      updateTriggers: { getText: [i, national] },
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
