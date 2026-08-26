import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const launchOptions = executablePath ? { executablePath, args: ["--no-sandbox"] } : undefined;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      BASIRA_BACKEND: "demo",
      BASIRA_APP_SECRET: "e2e-only-secret-change-me-please-32chars",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      BASIRA_DEMO_DB_PATH: ".data/e2e-db.json",
      BASIRA_DEMO_UPLOAD_DIR: ".data/e2e-uploads",
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], launchOptions } },
  ],
});
