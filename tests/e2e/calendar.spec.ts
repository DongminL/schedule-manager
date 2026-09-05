import { expect, test } from "@playwright/test";

import { login, MANAGER_PASSWORD, MANAGER_PHONE } from "./helpers";

/**
 * Smoke E2E for the calendar surface. Self-contained — `npm run test:e2e`
 * (via playwright.config.ts's globalSetup + webServer) resets its own DB and
 * starts its own server, so this needs nothing pre-running. See e2e-db.ts.
 */

test("login lands on the month calendar with a Sunday-first weekday header", async ({ page }) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  const cells = page.locator('[role="grid"] > div');
  await expect(cells.nth(0)).toHaveText("일");
  await expect(cells.nth(6)).toHaveText("토");
});

test("can switch to the daily timetable", async ({ page }) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);

  await page.getByRole("tab", { name: "일별" }).click();
  await page.waitForURL(/view=day/);
  // Fresh e2e DB has no shifts → the day timetable renders its empty state.
  // Seeing it proves the "일별" tab switch + view=day routing + DayTimetable
  // all mounted.
  await expect(page.getByText("이 날 근무가 없습니다.")).toBeVisible();
});

test("clicking a date cell in the month view opens that day", async ({ page }) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);

  const todayCell = page.locator('[role="grid"] [data-today]');
  const dayNum = await todayCell.locator("div").first().innerText();

  await todayCell.click();

  await page.waitForURL(/view=day/);
  await expect(page.getByRole("heading", { level: 2 })).toContainText(`${dayNum}일`);
});

test("manager can create a staff account and see it in the list", async ({ page }) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);
  await page.goto("/staff");

  const phone = `010${Date.now().toString().slice(-8)}`; // 11 digits
  await page.getByRole("button", { name: "직원 추가" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[placeholder="01012345678"]').fill(phone);
  await dialog.locator("input").first().fill("E2E 알바");
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(page.getByRole("cell", { name: phone })).toBeVisible();
});

test("change-request list renders with status tabs", async ({ page }) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);
  await page.goto("/requests");

  await expect(page.getByRole("heading", { name: "변경요청", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "대기", exact: true })).toBeVisible();
});

test("new request dialog picks the shift from a month calendar, not a dropdown", async ({
  page,
}) => {
  await login(page, MANAGER_PHONE, MANAGER_PASSWORD);
  await page.goto("/requests");

  await page.getByRole("button", { name: "변경 요청" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("heading", { name: "변경 요청할 근무 선택" })).toBeVisible();

  // The picker renders the same month grid as the main calendar (a `role="grid"`
  // with today's cell marked), not a fixed-range day strip or a dropdown.
  const todayCell = dialog.locator('[role="grid"] [data-today]');
  await expect(todayCell).toBeVisible();
  await expect(dialog.locator("select")).toHaveCount(0);
});
