import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akademik Takip",
    short_name: "Akademik Takip",
    description: "Günlük soru girişi, hedef takibi ve danışmanlık uygulaması",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    theme_color: "#4f46e5",
    background_color: "#f9fafb",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
