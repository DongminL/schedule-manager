/**
 * Single source of truth for the e2e run's throwaway Postgres — spun up as a
 * Testcontainers container by `global-setup.ts` and torn down by
 * `global-teardown.ts`. No dependency on `docker compose` or the developer's
 * `.env.local` DB: the only requirement is a running Docker daemon.
 *
 * The container binds a *fixed* host port so this URL is known at Playwright
 * config-load time (before `globalSetup` runs) — `playwright.config.ts` needs
 * it for `webServer.env.DATABASE_URL`. Override any of these via env vars for
 * CI or to dodge a port clash.
 */
export const E2E_DB_IMAGE = process.env.E2E_DB_IMAGE ?? "postgres:16-alpine";
export const E2E_DB_PORT = Number(process.env.E2E_DB_PORT ?? "54329");
export const E2E_DB_USER = "postgres";
export const E2E_DB_PASSWORD = "postgres";
export const E2E_DB_NAME = "schedule_manager_e2e";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://${E2E_DB_USER}:${E2E_DB_PASSWORD}@localhost:${E2E_DB_PORT}/${E2E_DB_NAME}`;

export const E2E_PORT = process.env.E2E_PORT ?? "3100";

export const E2E_MANAGER_PHONE = "01000000000";
export const E2E_MANAGER_PASSWORD = "e2e-manager-pw";
