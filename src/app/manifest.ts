import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Werwolf",
    short_name: "Werwolf",
    description: "Das Werwolf-Spiel für die ganze Familie.",
    lang: "de",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b24",
    theme_color: "#070b24",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
