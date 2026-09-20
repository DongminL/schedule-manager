import type { APIRequestContext, Browser, Page } from "@playwright/test";

import { E2E_MANAGER_PASSWORD, E2E_MANAGER_PHONE } from "./config/e2e-db";

/**
 * Login credentials for the MANAGER `global-setup.ts` seeds into the
 *  isolated e2e DB fresh on every run — fixed, so no env-var guessing.
 */
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

/** 
 * Unwraps this app's `{ success, data, error }` API envelope, throwing with
 * the server's message on failure (mirrors src/lib/api.ts for test code).
 */
export async function apiData<T>(res: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok() || !body.success) {
    throw new Error(`API call failed (${res.status()}): ${body.error?.message ?? res.statusText()}`);
  }
  return body.data as T;
}

/** 
 * YYYY-MM-DD `daysAhead` days from now, plus its day-of-week code, computed
 * in UTC so the pairing is independent of the test runner's local timezone.
 */
export function futureDate(daysAhead: number): { date: string; dayOfWeek: string } {
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return { date: d.toISOString().slice(0, 10), dayOfWeek: WEEKDAYS[d.getUTCDay()]! };
}

/** 
 * YYYY-MM-DD `daysAgo` days before now, plus its day-of-week code — the past
 * counterpart of `futureDate`, for seeding shifts that should be excluded
 * from change-request pickers.
 */
export function pastDate(daysAgo: number): { date: string; dayOfWeek: string } {
  return futureDate(-daysAgo);
}

/** Opens a fresh browser context/page and logs it in as the seeded MANAGER. */
export async function newManagerPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);
  return page;
}

export interface Staff {
  id: number;
  name: string;
  page: Page;
}

/** Creates a staff account via the API (as `managerPage`) and returns it
 *  logged in on its own page — the account's phone number doubles as its
 *  forced-first-login password. */
export async function seedStaff(managerPage: Page, browser: Browser, label: string): Promise<Staff> {
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const phone = `010${suffix}`;
  const name = `E2E ${label} ${suffix.slice(-4)}`;
  const created = await apiData<{ id: number }>(
    await managerPage.request.post("/api/staff", { data: { name, phoneNumber: phone } }),
  );
  const page = await (await browser.newContext()).newPage();
  await login(page, phone, phone);
  return { id: created.id, name, page };
}

/** Seeds a default schedule for `staffId`. Pass `endDate` equal to `date` to
 *  get a one-off occurrence instead of one recurring weekly into the future. */
export async function seedShift(
  managerPage: Page,
  staffId: number,
  date: string,
  dayOfWeek: string,
  startHhmm: string,
  endHhmm: string,
  options?: { endDate?: string },
): Promise<void> {
  await apiData(
    await managerPage.request.post(`/api/staff/${staffId}/default-schedules`, {
      data: { dayOfWeek, startHhmm, endHhmm, startDate: date, endDate: options?.endDate },
    }),
  );
}

/** KST year-month of "now", independent of the runner's local timezone. */
export function kstTodayMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}
