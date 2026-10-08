import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://backend:8080" },
  },
  preview: { allowedHosts: ["localhost", ".localhost"] },
});
