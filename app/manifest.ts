import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CasaMove · Casablanca",
    short_name: "CasaMove",
    description: "Itinéraires tramway et busway à Casablanca",
    start_url: "/fr",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fa",
    theme_color: "#142a42",
    icons: [
      {
        src: "/casamove-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/casamove-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/casamove-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Itinéraires", url: "/fr/journey" },
      { name: "Réseau", url: "/fr/network" },
    ],
  };
}
