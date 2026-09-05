import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { apiData, futureDate, login, MANAGER_PASSWORD, MANAGER_PHONE } from "./helpers";

// See substitute-request.spec.ts header for why this exists.
const REFRESH_TIMEOUT = 15_000;

/**
 * E2E for the full change-request lifecycle *starting from the UI form
 * submission* — calendar.spec.ts only smoke-tests the shift-picker step, and
 * substitute-request.spec.ts seeds its request via the API. These drive
 * NewRequestDialog's three forms (TimeAdjustForm / SubstituteForm / SwapForm)
 * end to end, then continue through peer accept/reject and manager
 * approve/reject on the request detail page. Self-contained (see
 * calendar.spec.ts header).
 */

interface Staff {
  id: number;
  name: string;
  page: Page;
}

async function seedStaff(managerPage: Page, browser: Browser, label: string): Promise<Staff> {
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

async function seedShift(
  managerPage: Page,
  staffId: number,
  date: string,
  dayOfWeek: string,
  startHhmm: string,
  endHhmm: string,
): Promise<void> {
  await apiData(
    await managerPage.request.post(`/api/staff/${staffId}/default-schedules`, {
      data: { dayOfWeek, startHhmm, endHhmm, startDate: date },
    }),
  );
}

/** KST year-month of "now", independent of the runner's local timezone. */
function kstTodayMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** The picker's "pick" step opens on the current KST month; every seeded
 *  shift here is within `futureDate`'s 7-11 day range, which can cross at
 *  most one month boundary, so a single "다음 달" click (if needed) suffices. */
async function navigateToMonthOf(scope: Locator, targetDate: string): Promise<void> {
  if (targetDate.slice(0, 7) === kstTodayMonth()) return;
  await scope.getByRole("button", { name: "다음 달" }).click();
}

/** Clicks a shift chip (identified by the exact title MonthGrid renders it
 *  with) inside its date cell. Scoping to the cell (`aria-label="{date} 일별
 *  보기"`) is required — a weekly default-schedule repeats the same
 *  time+name title across every visible week, so an unscoped title lookup
 *  matches multiple chips. */
async function pickShiftChip(scope: Locator, date: string, chipTitle: string): Promise<void> {
  await scope.getByRole("button", { name: `${date} 일별 보기` }).getByTitle(chipTitle).click();
}

/** Opens the new-request dialog and picks the viewer's own shift chip. */
async function openDialogAndPickOwnShift(
  page: Page,
  targetDate: string,
  chipTitle: string,
): Promise<Locator> {
  await page.goto("/requests");
  await page.getByRole("button", { name: "변경 요청" }).click();
  const dialog = page.locator("dialog[open]");
  await navigateToMonthOf(dialog, targetDate);
  await pickShiftChip(dialog, targetDate, chipTitle);
  return dialog;
}

/** After a form submits (dialog closes, list refreshes), finds the new card
 *  by its unique reason text and returns the request id from its detail URL. */
async function findSubmittedRequestId(page: Page, reason: string): Promise<string> {
  await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: REFRESH_TIMEOUT });
  await page.locator("a").filter({ hasText: reason }).click();
  await page.waitForURL(/\/requests\/\d+$/);
  return page.url().split("/").pop()!;
}

test.describe("change-request lifecycle", () => {
  test("TIME_ADJUST: submit via UI, manager approves", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "신청자");
    const { date, dayOfWeek } = futureDate(7);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    const reason = `E2E 시간변경승인 ${Date.now()}`;
    const dialog = await openDialogAndPickOwnShift(staffA.page, date, `09:00–13:00 ${staffA.name}`);
    await dialog.getByRole("button", { name: "시간 변경 신청" }).click();
    await dialog.locator('input[type="time"]').nth(0).fill("10:00");
    await dialog.locator('input[type="time"]').nth(1).fill("14:00");
    await dialog.locator("textarea").fill(reason);
    await dialog.getByRole("button", { name: "신청", exact: true }).click();

    const id = await findSubmittedRequestId(staffA.page, reason);

    await managerPage.goto(`/requests/${id}`);
    await expect(managerPage.getByText("대기", { exact: true })).toBeVisible();
    await managerPage.getByRole("button", { name: "승인" }).click();
    await expect(managerPage.getByText("승인", { exact: true })).toBeVisible({
      timeout: REFRESH_TIMEOUT,
    });
  });

  test("TIME_ADJUST: submit via UI, manager rejects", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "신청자");
    const { date, dayOfWeek } = futureDate(8);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    const reason = `E2E 시간변경거절 ${Date.now()}`;
    const dialog = await openDialogAndPickOwnShift(staffA.page, date, `09:00–13:00 ${staffA.name}`);
    await dialog.getByRole("button", { name: "시간 변경 신청" }).click();
    await dialog.locator('input[type="time"]').nth(0).fill("10:00");
    await dialog.locator('input[type="time"]').nth(1).fill("14:00");
    await dialog.locator("textarea").fill(reason);
    await dialog.getByRole("button", { name: "신청", exact: true }).click();

    const id = await findSubmittedRequestId(staffA.page, reason);

    const rejectReason = "일정상 어려움";
    await managerPage.goto(`/requests/${id}`);
    await managerPage.getByRole("button", { name: "거절", exact: true }).click();
    await managerPage.locator("textarea").fill(rejectReason);
    await managerPage.getByRole("button", { name: "거절 확정" }).click();
    await expect(managerPage.getByText("거절", { exact: true })).toBeVisible({
      timeout: REFRESH_TIMEOUT,
    });
    await expect(managerPage.getByText(rejectReason)).toBeVisible();
  });

  test("SHIFT: submit via UI, substitute accepts, manager approves", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "신청자");
    const staffB = await seedStaff(managerPage, browser, "대타");
    const { date, dayOfWeek } = futureDate(9);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    const reason = `E2E 대타승인 ${Date.now()}`;
    const dialog = await openDialogAndPickOwnShift(staffA.page, date, `09:00–13:00 ${staffA.name}`);
    await dialog.getByRole("button", { name: "대타 신청" }).click();
    await dialog.locator("select").selectOption({ label: staffB.name });
    await dialog.locator("textarea").fill(reason);
    await dialog.getByRole("button", { name: "신청", exact: true }).click();

    const id = await findSubmittedRequestId(staffA.page, reason);

    await staffB.page.goto(`/requests/${id}`);
    await expect(staffB.page.getByText("상대 수락 대기")).toBeVisible();
    await staffB.page.getByRole("button", { name: "대타 수락" }).click();
    await expect(staffB.page.getByText("수락됨")).toBeVisible({ timeout: REFRESH_TIMEOUT });

    await managerPage.goto(`/requests/${id}`);
    await expect(managerPage.getByText("대기", { exact: true })).toBeVisible();
    await managerPage.getByRole("button", { name: "승인" }).click();
    await expect(managerPage.getByText("승인", { exact: true })).toBeVisible({
      timeout: REFRESH_TIMEOUT,
    });
  });

  test("SHIFT: submit via UI, substitute rejects, closes without manager action", async ({
    browser,
  }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "신청자");
    const staffB = await seedStaff(managerPage, browser, "대타");
    const { date, dayOfWeek } = futureDate(10);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    const reason = `E2E 대타거절 ${Date.now()}`;
    const dialog = await openDialogAndPickOwnShift(staffA.page, date, `09:00–13:00 ${staffA.name}`);
    await dialog.getByRole("button", { name: "대타 신청" }).click();
    await dialog.locator("select").selectOption({ label: staffB.name });
    await dialog.locator("textarea").fill(reason);
    await dialog.getByRole("button", { name: "신청", exact: true }).click();

    const id = await findSubmittedRequestId(staffA.page, reason);

    await staffB.page.goto(`/requests/${id}`);
    staffB.page.once("dialog", (d) => d.accept("일정이 안 돼요"));
    await staffB.page.getByRole("button", { name: "대타 거절" }).click();
    await expect(staffB.page.getByText("거절", { exact: true })).toBeVisible({
      timeout: REFRESH_TIMEOUT,
    });

    await managerPage.goto(`/requests/${id}`);
    await expect(managerPage.getByRole("button", { name: "승인" })).toHaveCount(0);
  });

  test("SWAP: submit via UI, peer accepts, manager rejects", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "신청자");
    const staffB = await seedStaff(managerPage, browser, "교환상대");
    const { date, dayOfWeek } = futureDate(11);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");
    await seedShift(managerPage, staffB.id, date, dayOfWeek, "14:00", "18:00");

    const reason = `E2E 교환거절 ${Date.now()}`;
    const dialog = await openDialogAndPickOwnShift(staffA.page, date, `09:00–13:00 ${staffA.name}`);
    await dialog.getByRole("button", { name: "교환 신청" }).click();
    await pickShiftChip(dialog, date, `14:00–18:00 ${staffB.name}`);
    await dialog.locator("textarea").fill(reason);
    await dialog.getByRole("button", { name: "신청", exact: true }).click();

    const id = await findSubmittedRequestId(staffA.page, reason);

    await staffB.page.goto(`/requests/${id}`);
    await expect(staffB.page.getByText("상대 수락 대기")).toBeVisible();
    await staffB.page.getByRole("button", { name: "교환 수락" }).click();
    await expect(staffB.page.getByText("수락됨")).toBeVisible({ timeout: REFRESH_TIMEOUT });

    const rejectReason = "매장 사정상 어려움";
    await managerPage.goto(`/requests/${id}`);
    await managerPage.getByRole("button", { name: "거절", exact: true }).click();
    await managerPage.locator("textarea").fill(rejectReason);
    await managerPage.getByRole("button", { name: "거절 확정" }).click();
    await expect(managerPage.getByText("거절", { exact: true })).toBeVisible({
      timeout: REFRESH_TIMEOUT,
    });
  });
});
