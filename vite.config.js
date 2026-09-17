import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Injecte la date/heure de compilation dans le code, utilisée pour
  // afficher automatiquement un numéro de version (V: AAAAMMJJ-HHMM).
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      output: {
        // jsPDF est déjà chargé à la demande (dynamic import) et forme
        // donc son propre chunk séparé automatiquement. On isole aussi
        // les librairies tierces stables dans un chunk "vendor" dédié,
        // pour un bundle initial plus léger et mieux mis en cache.
        manualChunks: {
          vendor: ["react", "react-dom", "lucide-react"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En développement (npm run dev), redirige les appels API
      // vers le serveur Express lancé séparément (npm run server).
      "/api": "http://localhost:3001",
    },
  },
});
