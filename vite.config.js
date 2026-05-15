/**
 * dilbar — vite.config.js
 * ─────────────────────────────────────────────────────────────
 * Vite build configuration.
 *
 * Uses the official React plugin for JSX transform.
 * No custom aliases needed — all imports use relative paths.
 * ─────────────────────────────────────────────────────────────
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    // Output directory — Vercel serves from here
    outDir: "dist",

    // Raise the chunk size warning threshold slightly
    // (Recharts is large but acceptable for this use case)
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Split vendor libraries into a separate chunk
        // so the app code stays small and caches independently
        manualChunks: {
          react:    ["react", "react-dom"],
          recharts: ["recharts"],
        },
      },
    },
  },

  server: {
    // Local dev port
    port: 5173,
    open: true,
  },
});
