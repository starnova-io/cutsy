import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  assetsInclude: ["**/*.glb"],
  build: { target: "es2020", chunkSizeWarningLimit: 2000, assetsInlineLimit: 8 * 1024 * 1024 },
});
