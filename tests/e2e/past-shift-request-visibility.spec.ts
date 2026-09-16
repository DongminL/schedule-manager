import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { apiData, futureDate, login, MANAGER_PASSWORD, MANAGER_PHONE, pastDate } from "./helpers";

/**
 * E2E for hiding change-request options on shifts dated before "today" (KST).
 * Covers both places the request says they must disappear:
 *  - the shift pickers inside the change-request flow (own shift in
 *    NewRequestDialog, the counterpart's shift in SwapForm) — both backed by
 *    the same ShiftCalendarPicker component
 *  - the calendar's own ShiftActionsDialog, opened by clicking a shift
 *    directly on the day timetable
 * Self-contained (see calendar.spec.ts header).
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

/** `startDate === endDate` so the pattern resolves to exactly one occurrence
 *  instead of recurring weekly into the future too. */
async function seedOneOffShift(
  managerPage: Page,
  staffId: number,
  date: string,
  dayOfWeek: string,
  startHhmm: string,
  endHhmm: string,
): Promise<void> {
  await apiData(
    await managerPage.request.post(`/api/staff/${staffId}/default-schedules`, {
      data: { dayOfWeek, startHhmm, endHhmm, startDate: date, endDate: date },
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

/** Clicks the month-nav button toward `targetDate`'s month, from `fromMonth`.
 *  The dates this file seeds (a few days ago / from now) cross at most one
 *  month boundary, so a couple of clicks is always enough. */
async function navigateToMonth(scope: Locator, targetDate: string, fromMonth: string): Promise<void> {
  let month = fromMonth;
  const targetMonth = targetDate.slice(0, 7);
  for (let i = 0; i < 2 && month !== targetMonth; i++) {
    const dir = targetMonth < month ? "이전 달" : "다음 달";
    await scope.getByRole("button", { name: dir }).click();
    month = targetMonth < month ? monthBefore(month) : monthAfter(month);
  }
}

function monthAfter(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthBefore(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

test.describe("change-request visibility for past shifts", () => {
  test("own shift picker hides a shift dated before today", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "과거본인");
    const { date, dayOfWeek } = pastDate(3);
    await seedOneOffShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    await staffA.page.goto("/requests");
    await staffA.page.getByRole("button", { name: "변경 요청" }).click();
    const dialog = staffA.page.locator("dialog[open]");
    await navigateToMonth(dialog, date, kstTodayMonth());

    await dialog.getByRole("button", { name: `${date} 일별 보기` }).click();
    await expect(dialog.getByText("이 날 근무가 없습니다.")).toBeVisible();
  });

  test("swap peer picker hides the other staff's shift dated before today", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "교환신청자");
    const staffB = await seedStaff(managerPage, browser, "과거상대");
    const own = futureDate(7);
    await seedOneOffShift(managerPage, staffA.id, own.date, own.dayOfWeek, "09:00", "13:00");
    const peerPast = pastDate(3);
    await seedOneOffShift(managerPage, staffB.id, peerPast.date, peerPast.dayOfWeek, "14:00", "18:00");

    await staffA.page.goto("/requests");
    await staffA.page.getByRole("button", { name: "변경 요청" }).click();
    const dialog = staffA.page.locator("dialog[open]");
    await navigateToMonth(dialog, own.date, kstTodayMonth());
    await dialog
      .getByRole("button", { name: `${own.date} 일별 보기` })
      .getByTitle(`09:00–13:00 ${staffA.name}`)
      .click();

    await dialog.getByRole("button", { name: "교환 신청" }).click();
    await navigateToMonth(dialog, peerPast.date, own.date.slice(0, 7));

    await dialog.getByRole("button", { name: `${peerPast.date} 일별 보기` }).click();
    await expect(dialog.getByText("이 날 근무가 없습니다.")).toBeVisible();
  });

  test("calendar's own shift dialog hides request buttons for a past shift", async ({ browser }) => {
    const managerPage = await (await browser.newContext()).newPage();
    await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

    const staffA = await seedStaff(managerPage, browser, "과거클릭");
    const { date, dayOfWeek } = pastDate(3);
    await seedOneOffShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00");

    await staffA.page.goto(`/?view=day&date=${date}`);
    await staffA.page.getByTitle(`${staffA.name} · 09:00–13:00 · 기본 근무`).click();

    const dialog = staffA.page.locator("dialog[open]");
    await expect(dialog.getByRole("heading", { name: "근무 상세" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "시간 변경 신청" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "대타 신청" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "교환 신청" })).toHaveCount(0);
  });
});
