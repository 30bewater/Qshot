import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    {
      name: "protocol",
      testMatch: /protocol-bridge\.spec\.js/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:4173",
      },
    },
    {
      name: "extension-smoke",
      testMatch: /extension-compare-smoke\.spec\.js/,
      timeout: 360_000,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npx --yes serve tests/e2e/fixtures -p 4173 --no-port-switching",
    url: "http://127.0.0.1:4173/protocol-bridge.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
