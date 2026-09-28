const mockPending: Promise<unknown>[] = [];
jest.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    mockPending.push(task());
  },
}));
jest.mock("@/modules/notification/application/notificationService", () => ({
  notifyUsers: jest.fn(),
}));
jest.mock("@/modules/change-request/infrastructure/changeRequestRepository", () => ({
  findSwapByParent: jest.fn(),
  findSubstituteByParent: jest.fn(),
}));
jest.mock("@/modules/account/infrastructure/userRepository", () => ({
  findById: jest.fn(),
  listActiveManagerIds: jest.fn(),
}));

import * as userRepo from "@/modules/account/infrastructure/userRepository";
import { notifyRequestEvent } from "@/modules/change-request/application/requestNotifier";
import * as repo from "@/modules/change-request/infrastructure/changeRequestRepository";
import * as notification from "@/modules/notification/application/notificationService";

const notify = notification as jest.Mocked<typeof notification>;
const r = repo as jest.Mocked<typeof repo>;
const users = userRepo as jest.Mocked<typeof userRepo>;

/** notifyRequestEvent defers work via after(); run it and wait for the deferred task. */
const run = async (...args: Parameters<typeof notifyRequestEvent>): Promise<void> => {
  notifyRequestEvent(...args);
  await Promise.all(mockPending.splice(0));
};

const REQUESTER_ID = 5;
const PEER_ID = 7;
const MANAGER_IDS = [1, 2];

const base = {
  id: 10,
  userId: REQUESTER_ID,
  type: "TIME_ADJUST" as const,
  status: "PENDING" as const,
} as never;

const withShape = (type: string, status: string) => ({ ...(base as object), type, status }) as never;

beforeEach(() => {
  users.findById.mockImplementation(async (id: number) =>
    id === REQUESTER_ID
      ? ({ id, name: "알바" } as never)
      : id === PEER_ID
        ? ({ id, name: "동료" } as never)
        : undefined,
  );
  users.listActiveManagerIds.mockResolvedValue(MANAGER_IDS);
  r.findSwapByParent.mockResolvedValue({ peerUserId: PEER_ID } as never);
  r.findSubstituteByParent.mockResolvedValue({ userId: PEER_ID } as never);
});

describe("notifyRequestEvent", () => {
  test("CREATED TIME_ADJUST(PENDING) → managers", async () => {
    await run("CREATED", base);
    expect(notify.notifyUsers).toHaveBeenCalledWith(MANAGER_IDS, {
      title: "변경 요청",
      body: "알바님이 변경 요청을 보냈습니다.",
      url: "/requests/10",
    });
  });

  test("CREATED by a manager → excludes the requester from recipients", async () => {
    await run("CREATED", { ...(base as object), userId: 1 } as never);
    expect(notify.notifyUsers).toHaveBeenCalledWith([2], expect.anything());
  });

  test("CREATED SWAP(WAITING_PEER_ACCEPT) → the swap peer only", async () => {
    await run("CREATED", withShape("SWAP", "WAITING_PEER_ACCEPT"));
    expect(notify.notifyUsers).toHaveBeenCalledTimes(1);
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      [PEER_ID],
      expect.objectContaining({ body: "알바님이 변경 요청을 보냈습니다." }),
    );
  });

  test("CREATED SHIFT(WAITING_PEER_ACCEPT) → the substitute only", async () => {
    await run("CREATED", withShape("SHIFT", "WAITING_PEER_ACCEPT"));
    expect(notify.notifyUsers).toHaveBeenCalledWith([PEER_ID], expect.anything());
  });

  test("PEER_ACCEPTED → managers", async () => {
    await run("PEER_ACCEPTED", withShape("SWAP", "PENDING"));
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      MANAGER_IDS,
      expect.objectContaining({ body: "알바님이 변경 요청을 보냈습니다." }),
    );
  });

  test("PEER_REJECTED → requester, naming the peer", async () => {
    await run("PEER_REJECTED", withShape("SWAP", "REJECT"));
    expect(notify.notifyUsers).toHaveBeenCalledWith([REQUESTER_ID], {
      title: "변경 요청",
      body: "동료님이 변경 요청을 거절했습니다.",
      url: "/requests/10",
    });
  });

  test("MANAGER_REJECTED → requester", async () => {
    await run("MANAGER_REJECTED", withShape("TIME_ADJUST", "REJECT"));
    expect(notify.notifyUsers).toHaveBeenCalledWith([REQUESTER_ID], {
      title: "변경 요청",
      body: "변경 요청이 거절되었습니다.",
      url: "/requests/10",
    });
  });

  test("APPROVED SWAP → requester and peer", async () => {
    await run("APPROVED", withShape("SWAP", "APPROVAL"));
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      [REQUESTER_ID, PEER_ID],
      expect.objectContaining({ body: "변경 요청이 승인되었습니다." }),
    );
  });

  test("APPROVED TIME_ADJUST → requester only", async () => {
    await run("APPROVED", withShape("TIME_ADJUST", "APPROVAL"));
    expect(notify.notifyUsers).toHaveBeenCalledWith([REQUESTER_ID], expect.anything());
  });

  test("never throws when lookup or delivery fails", async () => {
    users.findById.mockRejectedValue(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(run("CREATED", base)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test("skips delivery when there is nobody to notify", async () => {
    users.listActiveManagerIds.mockResolvedValue([REQUESTER_ID]);
    await run("CREATED", base);
    expect(notify.notifyUsers).not.toHaveBeenCalled();
  });
});
