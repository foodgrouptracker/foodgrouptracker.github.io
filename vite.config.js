import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import fs from "node:fs";

// Where does the app live?
//  - a repo named <owner>.github.io, or a custom domain (public/CNAME present): the root, "/"
//  - any other GitHub Pages repo: under /<repo>/ (the deploy workflow passes VITE_BASE)
const hasCustomDomain = fs.existsSync(new URL("./public/CNAME", import.meta.url));
const envBase = process.env.VITE_BASE || "/";
const isUserOrOrgSite = /\.github\.io\/$/i.test(envBase);
const base = hasCustomDomain || isUserOrOrgSite ? "/" : envBase;

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Food Group Tracker",
        short_name: "Food Group Tracker",
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
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,json}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globIgnores: ["configure/**"],
        navigateFallbackDenylist: [/\/configure\//],
      },
    }),
  ],
});
