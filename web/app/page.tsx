"use client";

import dynamic from "next/dynamic";

// WebGL n'existe que dans le navigateur : pas de rendu côté serveur pour la carte.
const Tableau = dynamic(() => import("@/components/Tableau"), { ssr: false });

export default function Page() {
  return <Tableau />;
}
