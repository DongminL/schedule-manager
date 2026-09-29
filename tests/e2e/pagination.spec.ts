import { expect, test } from "@playwright/test";
import { randomInt } from "node:crypto";

import { apiData, futureDate, login, MANAGER_PASSWORD, MANAGER_PHONE, seedStaff } from "./helpers";

/**
 * E2E for the page-number pagination on /staff and /requests. Seeds enough
 * rows through the real API to force >=2 pages, then drives the actual UI
 * (URL -> server query -> rendered rows) end to end. The 5-page block
 * windowing math itself is unit-tested in src/components/ui/Pagination.test.tsx
 * — this file only checks the wiring: paging changes the row set, and
 * filters/tabs interact with `pageNo` correctly.
 */

test("staff list: paging shows a disjoint set of rows, and switching tabs resets to page 1", async ({
  browser,
}) => {
  const managerPage = await (await browser.newContext()).newPage();
  await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

  // Enough new active staff to guarantee >=2 pages regardless of whatever
  // other specs already added to this shared e2e DB.
  const base = `${Date.now().toString().slice(-5)}${randomInt(10, 100)}`;
  await Promise.all(
    Array.from({ length: 25 }, async (_, i) =>
      apiData(
        await managerPage.request.post("/api/staff", {
          data: {
            name: `E2E 페이지네이션 재직${i}`,
            phoneNumber: `0${base}${String(i).padStart(2, "0")}`,
          },
        }),
      ),
    ),
  );

  await managerPage.goto("/staff?tab=active");
  const nav = managerPage.getByRole("navigation", { name: "페이지네이션" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "이전" })).toBeDisabled();

  const page1Names = await managerPage
    .locator("table a")
    .evaluateAll((links) => links.map((l) => l.getAttribute("title")));

  await nav.getByRole("button", { name: "2" }).click();
  await expect(managerPage).toHaveURL(/tab=active&pageNo=2/);

  const page2Names = await managerPage
    .locator("table a")
    .evaluateAll((links) => links.map((l) => l.getAttribute("title")));
  expect(page1Names.some((name) => page2Names.includes(name))).toBe(false);

  // Switching tabs resets the page instead of carrying pageNo=2 over.
  await managerPage.getByRole("tab", { name: "퇴사자" }).click();
  await expect(managerPage).toHaveURL(/tab=resigned/);
  expect(managerPage.url()).not.toContain("pageNo");
});

test("requests list: paging preserves the active status filter", async ({ browser }) => {
  const managerPage = await (await browser.newContext()).newPage();
  await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

  const staff = await seedStaff(managerPage, browser, "요청페이지");

  const { date, dayOfWeek } = futureDate(60);
  const pattern = await apiData<{ id: number }>(
    await managerPage.request.post(`/api/staff/${staff.id}/default-schedules`, {
      data: { dayOfWeek, startHhmm: "09:00", endHhmm: "13:00", startDate: date },
    }),
  );

  // `resolveTargetShift` only checks the pattern exists and this exact
  // (userId, updateDate, targetDefaultScheduleId) hasn't been touched yet —
  // it never cross-checks that `updateDate` falls on the pattern's real
  // day-of-week — so one seeded pattern can back every request below as
  // long as each uses a distinct date.
  await Promise.all(
    Array.from({ length: 20 }, async (_, i) => {
      const d = futureDate(60 + i).date;
      return apiData(
        await staff.page.request.post("/api/schedule-changes", {
          data: {
            type: "TIME_ADJUST",
            updateDate: d,
            startAt: `${d}T09:00:00Z`,
            endAt: `${d}T13:00:00Z`,
            targetDefaultScheduleId: pattern.id,
            adjustStartAt: `${d}T10:00:00Z`,
            adjustEndAt: `${d}T14:00:00Z`,
            reason: `E2E 페이지네이션 사유 ${i}`,
          },
        }),
      );
    }),
  );

  await staff.page.goto("/requests");
  await staff.page.getByRole("tab", { name: "대기", exact: true }).click();
  await expect(staff.page).toHaveURL(/status=PENDING/);

  const nav = staff.page.getByRole("navigation", { name: "페이지네이션" });
  await expect(nav).toBeVisible();

  const page1Reasons = await staff.page
    .locator("p", { hasText: "E2E 페이지네이션 사유" })
    .allTextContents();

  await nav.getByRole("button", { name: "다음" }).click();
  await expect(staff.page).toHaveURL(/status=PENDING&pageNo=2/);

  const page2Reasons = await staff.page
    .locator("p", { hasText: "E2E 페이지네이션 사유" })
    .allTextContents();
  expect(page1Reasons.length).toBeGreaterThan(0);
  expect(page2Reasons.length).toBeGreaterThan(0);
  expect(page1Reasons.some((r) => page2Reasons.includes(r))).toBe(false);
});
