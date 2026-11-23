import type { NextConfig } from "next";

// Version en ligne (GitHub Pages) : site entièrement statique, servi sous /reseau-electrique-fr.
const statique = process.env.NEXT_PUBLIC_STATIQUE === "1";

const nextConfig: NextConfig = {
  ...(statique
    ? { output: "export", basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "", trailingSlash: true }
    : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
