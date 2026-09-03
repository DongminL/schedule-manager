import type { APIRequestContext, Page } from "@playwright/test";

import { E2E_MANAGER_PASSWORD, E2E_MANAGER_PHONE } from "./config/e2e-db";

/** Login credentials for the MANAGER `global-setup.ts` seeds into the
 *  isolated e2e DB fresh on every run — fixed, so no env-var guessing. */
export const MANAGER_PHONE = E2E_MANAGER_PHONE;
export const MANAGER_PASSWORD = E2E_MANAGER_PASSWORD;

/** Password every test-created account is left on after its forced first login. */
export const E2E_PASSWORD = "e2e-passw0rd";

/**
 * Logs `page` in via the login form. If the account still needs its forced
 * first-login password change (fresh staff accounts always do), completes
 * that too and lands on the calendar.
 */
export async function login(page: Page, phone: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="phoneNumber"]', phone);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // The login form does a client-side `router.replace(callbackUrl)`, which the
  // App Router can briefly land on before the (app) layout's server-side
  // `redirect("/change-password")` swaps the URL again — wait for that second
  // hop to settle before reading `page.url()`, or a forced-change account gets
  // read as already being on "/".
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");

  if (page.url().includes("/change-password")) {
    const news = page.locator('input[autocomplete="new-password"]');
    await news.nth(0).fill(E2E_PASSWORD);
    await news.nth(1).fill(E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === "/");
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

/** Unwraps this app's `{ success, data, error }` API envelope, throwing with
 *  the server's message on failure (mirrors src/lib/api.ts for test code). */
export async function apiData<T>(res: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok() || !body.success) {
    throw new Error(`API call failed (${res.status()}): ${body.error?.message ?? res.statusText()}`);
  }
  return body.data as T;
}

/** YYYY-MM-DD `daysAhead` days from now, plus its day-of-week code, computed
 *  in UTC so the pairing is independent of the test runner's local timezone. */
export function futureDate(daysAhead: number): { date: string; dayOfWeek: string } {
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return { date: d.toISOString().slice(0, 10), dayOfWeek: WEEKDAYS[d.getUTCDay()]! };
}
