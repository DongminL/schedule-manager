import { expect, test, type Locator } from "@playwright/test";

import {
  futureDate,
  kstTodayMonth,
  newManagerPage,
  pastDate,
  seedShift,
  seedStaff,
} from "./helpers";

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

/** Navigates the shift-picker's day-view to `targetDate` and asserts it has
 *  no shift chip — the state a past-dated shift must produce, in both the
 *  own-shift picker and the swap peer picker. */
async function expectDayPickerEmpty(dialog: Locator, targetDate: string, fromMonth: string): Promise<void> {
  await navigateToMonth(dialog, targetDate, fromMonth);
  await dialog.getByRole("button", { name: `${targetDate} 일별 보기` }).click();
  await expect(dialog.getByText("이 날 근무가 없습니다.")).toBeVisible();
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
    const managerPage = await newManagerPage(browser);

    const staffA = await seedStaff(managerPage, browser, "과거본인");
    const { date, dayOfWeek } = pastDate(3);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00", { endDate: date });

    await staffA.page.goto("/requests");
    await staffA.page.getByRole("button", { name: "변경 요청" }).click();
    const dialog = staffA.page.locator("dialog[open]");
    await expectDayPickerEmpty(dialog, date, kstTodayMonth());
  });

  test("swap peer picker hides the other staff's shift dated before today", async ({ browser }) => {
    const managerPage = await newManagerPage(browser);

    const staffA = await seedStaff(managerPage, browser, "교환신청자");
    const staffB = await seedStaff(managerPage, browser, "과거상대");
    const own = futureDate(7);
    await seedShift(managerPage, staffA.id, own.date, own.dayOfWeek, "09:00", "13:00", {
      endDate: own.date,
    });
    const peerPast = pastDate(3);
    await seedShift(managerPage, staffB.id, peerPast.date, peerPast.dayOfWeek, "14:00", "18:00", {
      endDate: peerPast.date,
    });

    await staffA.page.goto("/requests");
    await staffA.page.getByRole("button", { name: "변경 요청" }).click();
    const dialog = staffA.page.locator("dialog[open]");
    await navigateToMonth(dialog, own.date, kstTodayMonth());
    await dialog
      .getByRole("button", { name: `${own.date} 일별 보기` })
      .getByTitle(`09:00–13:00 ${staffA.name}`)
      .click();

    await dialog.getByRole("button", { name: "교환 신청" }).click();
    await expectDayPickerEmpty(dialog, peerPast.date, own.date.slice(0, 7));
  });

  test("calendar's own shift dialog hides request buttons for a past shift", async ({ browser }) => {
    const managerPage = await newManagerPage(browser);

    const staffA = await seedStaff(managerPage, browser, "과거클릭");
    const { date, dayOfWeek } = pastDate(3);
    await seedShift(managerPage, staffA.id, date, dayOfWeek, "09:00", "13:00", { endDate: date });

    await staffA.page.goto(`/?view=day&date=${date}`);
    await staffA.page.getByTitle(`${staffA.name} · 09:00–13:00 · 기본 근무`).click();

    const dialog = staffA.page.locator("dialog[open]");
    await expect(dialog.getByRole("heading", { name: "근무 상세" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "시간 변경 신청" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "대타 신청" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "교환 신청" })).toHaveCount(0);
  });
});
