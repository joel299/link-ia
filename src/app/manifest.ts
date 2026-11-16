import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkIA — sua página profissional",
    short_name: "LinkIA",
    description:
      "Acesse seus perfis, canais e campanhas em uma experiência feita para celular.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#101312",
    theme_color: "#101312",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
