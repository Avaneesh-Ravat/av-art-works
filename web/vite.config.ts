import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the API gateway. In dev we proxy /api to the gateway
// so the browser sees a same-origin API and avoids CORS entirely.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
