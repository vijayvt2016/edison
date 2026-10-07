import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Cesium loads workers and textures from here (copied by scripts/copy-cesium.mjs)
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },
  server: { port: 5173, open: true },
  build: { chunkSizeWarningLimit: 8000 },
});
