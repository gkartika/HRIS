import type { MetadataRoute } from "next";

// Lets the browser offer "install app" (Chrome/Edge address bar, Android menu,
// iPhone "Add to Home Screen"). The installed app opens the same website in its
// own window; it does not store any employee data on the device.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SAPA — PT Cahaya Bukit Perunggu",
    short_name: "SAPA",
    description: "SAPA: Sistem Administrasi dan Pelayanan kAryawan",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "id",
    background_color: "#fbf8fc",
    theme_color: "#552c59",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
