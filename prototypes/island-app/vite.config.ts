import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  assetsInclude: ["**/*.glb"],
  resolve: {
    alias: {
      // Analytics is native-only; keep the Firebase web SDK out of the bundle.
      "firebase/analytics": fileURLToPath(new URL("./src/native/firebase-analytics-stub.ts", import.meta.url)),
    },
  },
  build: { target: "es2020", emptyOutDir: false, chunkSizeWarningLimit: 2000, assetsInlineLimit: 8 * 1024 * 1024 },
});
