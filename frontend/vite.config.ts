import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.VITE_API_PROXY ?? "http://backend:8080" },
  },
  preview: { host: "0.0.0.0", allowedHosts: ["frontend"] },
});
