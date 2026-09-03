import { defineConfig, devices } from "@playwright/test";

import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/config/e2e-db";

/**
 * E2E config. Fully self-contained: `globalSetup` starts a throwaway Postgres
 * container (Testcontainers), migrates + seeds it, and `globalTeardown` stops
 * it (see tests/e2e/config/). `webServer` always starts a fresh dev server
 * bound to that container on its own port — never the developer's `npm run dev`
 * / dev DB. Run: `npm run test:e2e`. Needs only a running Docker daemon.
 */
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/config/global-setup.ts",
  globalTeardown: "./tests/e2e/config/global-teardown.ts",
  timeout: 30_000,
  // One shared e2e DB + one seeded MANAGER account, and specs create global
  // staff/schedules/requests with no per-test isolation — so the whole suite
  // runs serially. `fullyParallel: false` alone only serializes within a file.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${E2E_PORT}`,
    // Wait only for the port to listen — NOT an HTTP status check on `/`.
    // globalSetup (which starts the DB container) runs *after* webServer is
    // ready, so any route that touches the DB would 500 during an HTTP probe
    // and deadlock the run. Tests only hit the app after globalSetup completes.
    port: Number(E2E_PORT),
    // Always a fresh server against the isolated e2e DB — never reuse a
    // developer's already-running dev server (that would point at their dev
    // DB and defeat the isolation above).
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      REDIS_URL: "",
    },
  },
});
