import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mobility Maroc",
    short_name: "Mobility",
    description: "Tous vos transports au Maroc, un seul point d'entrée",
    start_url: "/fr",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#0b1728",
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
      { name: "Itinéraires", url: "/fr/tram/journey" },
      { name: "Réseau", url: "/fr/tram/network" },
    ],
  };
}
