import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// On GitHub Pages the app lives under /<repo>/ ; the deploy workflow sets VITE_BASE.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "configure/index.html"],
      manifest: {
        name: "Food Group Tracker",
        short_name: "Food Groups",
        description: "Check one box for each serving you eat. Everything stays on your phone.",
        // No start_url on purpose: on iPhone the home-screen icon then launches the page that
        // was added, which carries the dietitian's #plan= link into the installed app.
        display: "standalone",
        background_color: "#F6F8F6",
        theme_color: "#F6F8F6",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallbackDenylist: [/\/configure\//],
      },
    }),
  ],
});
