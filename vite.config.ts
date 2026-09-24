import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg", "maps/*.geojson"],
      manifest: {
        name: "Atlas Dominion",
        short_name: "Atlas",
        description: "A persistent world of cities, resources and armies.",
        theme_color: "#132b2c",
        background_color: "#102021",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,geojson}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
