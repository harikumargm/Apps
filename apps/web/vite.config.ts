import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const apiTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    port,
    strictPort: false,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    port,
    strictPort: false,
  },
});
