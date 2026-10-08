import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4179",
    viewport: { width: 1440, height: 1000 },
    trace: "off", // Authentication traces can contain credentials; never persist them.
    screenshot: "only-on-failure",
  },
});
