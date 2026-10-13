import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:18760",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
});
