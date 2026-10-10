import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target:
          loadEnv("development", ".", "API_").API_PROXY_TARGET ??
          "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    restoreMocks: true,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: ["localhost", "frontend"],
  },
});
