import { expect, test, type Browser, type Page } from "@playwright/test";

import { apiData, futureDate, login, MANAGER_PASSWORD, MANAGER_PHONE } from "./helpers";

/**
 * E2E for the "대타" (SHIFT) change-request flow now requiring the assigned
 * substitute's acceptance before a manager can approve it — same gate SWAP
 * requests already had. Self-contained (see calendar.spec.ts header).
 *
 * Staff/schedule/request setup goes through the API (authenticated via each
 * actor's own logged-in page context) so the test doesn't depend on any
 * pre-existing calendar data; the actual behavior under test — the peer-accept
 * gate — is driven through the real UI.
 */

interface CreatedRequest {
  id: number;
  managerPage: Page;
  staffAPage: Page;
  staffBPage: Page;
}

async function createPendingShiftRequest(browser: Browser): Promise<CreatedRequest> {
  const managerPage = await (await browser.newContext()).newPage();
  await login(managerPage, MANAGER_PHONE, MANAGER_PASSWORD);

  const suffix = Date.now().toString().slice(-8);
  const phoneA = `010${suffix.slice(0, 4)}0001`;
  const phoneB = `010${suffix.slice(0, 4)}0002`;

  const staffA = await apiData<{ id: number }>(
    await managerPage.request.post("/api/staff", {
      data: { name: "E2E 요청자", phoneNumber: phoneA },
    }),
  );
  const staffB = await apiData<{ id: number }>(
    await managerPage.request.post("/api/staff", {
      data: { name: "E2E 대타", phoneNumber: phoneB },
    }),
  );

  const { date, dayOfWeek } = futureDate(7);
  await apiData(
    await managerPage.request.post(`/api/staff/${staffA.id}/default-schedules`, {
      data: { dayOfWeek, startHhmm: "09:00", endHhmm: "13:00", startDate: date },
    }),
  );

  const staffAPage = await (await browser.newContext()).newPage();
  await login(staffAPage, phoneA, phoneA);

  const { shifts } = await apiData<{
    shifts: { defaultScheduleId: number | null; startAt: string; endAt: string }[];
  }>(await staffAPage.request.get(`/api/schedules?from=${date}&to=${date}&userId=${staffA.id}`));
  const target = shifts[0]!;

  const created = await apiData<{ id: number }>(
    await staffAPage.request.post("/api/schedule-changes", {
      data: {
        type: "SHIFT",
        updateDate: date,
        startAt: target.startAt,
        endAt: target.endAt,
        targetDefaultScheduleId: target.defaultScheduleId,
        reason: "E2E 사유",
        substituteUserId: staffB.id,
      },
    }),
  );

  const staffBPage = await (await browser.newContext()).newPage();
  await login(staffBPage, phoneB, phoneB);

  return { id: created.id, managerPage, staffAPage, staffBPage };
}

test("substitute must accept before the manager can approve", async ({ browser }) => {
  const { id, managerPage, staffBPage } = await createPendingShiftRequest(browser);

  // Waiting on the substitute: manager sees no approve/reject yet.
  await managerPage.goto(`/requests/${id}`);
  await expect(managerPage.getByText("상대 수락 대기")).toBeVisible();
  await expect(managerPage.getByRole("button", { name: "승인" })).toHaveCount(0);

  // Substitute accepts from the request detail page.
  await staffBPage.goto(`/requests/${id}`);
  await expect(staffBPage.getByRole("button", { name: "대타 수락" })).toBeVisible();
  await staffBPage.getByRole("button", { name: "대타 수락" }).click();
  await expect(staffBPage.getByText("수락됨")).toBeVisible();

  // Now the manager can approve.
  await managerPage.goto(`/requests/${id}`);
  await expect(managerPage.getByText("대기", { exact: true })).toBeVisible();
  await managerPage.getByRole("button", { name: "승인" }).click();
  await expect(managerPage.getByText("승인", { exact: true })).toBeVisible();
});

test("substitute rejection closes the request without manager action", async ({ browser }) => {
  const { id, managerPage, staffBPage } = await createPendingShiftRequest(browser);

  await staffBPage.goto(`/requests/${id}`);
  staffBPage.once("dialog", (d) => d.accept("일정이 안 돼요"));
  await staffBPage.getByRole("button", { name: "대타 거절" }).click();
  await expect(staffBPage.getByText("거절", { exact: true })).toBeVisible();

  await managerPage.goto(`/requests/${id}`);
  await expect(managerPage.getByRole("button", { name: "승인" })).toHaveCount(0);
});
