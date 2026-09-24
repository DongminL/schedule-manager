jest.mock("@/modules/notification/infrastructure/pushTokenRepository", () => ({
  replaceUserToken: jest.fn(),
  deleteByToken: jest.fn(),
  deleteByTokens: jest.fn(),
  findTokensByUserIds: jest.fn(),
}));
jest.mock("@/modules/notification/infrastructure/fcmClient", () => ({
  sendToTokens: jest.fn(),
}));

import * as service from "@/modules/notification/application/notificationService";
import * as fcm from "@/modules/notification/infrastructure/fcmClient";
import * as tokens from "@/modules/notification/infrastructure/pushTokenRepository";

const t = tokens as jest.Mocked<typeof tokens>;
const f = fcm as jest.Mocked<typeof fcm>;

const payload = { title: "변경 요청", body: "본문", url: "/requests/1" };

describe("notifyUsers", () => {
  test("looks up tokens of the (deduplicated) users and sends", async () => {
    t.findTokensByUserIds.mockResolvedValue(["a", "b"]);
    f.sendToTokens.mockResolvedValue([]);

    await service.notifyUsers([1, 2, 2], payload);

    expect(t.findTokensByUserIds).toHaveBeenCalledWith([1, 2]);
    expect(f.sendToTokens).toHaveBeenCalledWith(["a", "b"], payload);
    expect(t.deleteByTokens).not.toHaveBeenCalled();
  });

  test("does nothing when there are no recipients or tokens", async () => {
    await service.notifyUsers([], payload);
    expect(t.findTokensByUserIds).not.toHaveBeenCalled();

    t.findTokensByUserIds.mockResolvedValue([]);
    await service.notifyUsers([1], payload);
    expect(f.sendToTokens).not.toHaveBeenCalled();
  });

  test("deletes tokens FCM reports as invalid", async () => {
    t.findTokensByUserIds.mockResolvedValue(["a", "dead"]);
    f.sendToTokens.mockResolvedValue(["dead"]);

    await service.notifyUsers([1], payload);

    expect(t.deleteByTokens).toHaveBeenCalledWith(["dead"]);
  });

  test("swallows delivery errors (must not break the request flow)", async () => {
    t.findTokensByUserIds.mockResolvedValue(["a"]);
    f.sendToTokens.mockRejectedValue(new Error("fcm down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.notifyUsers([1], payload)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("registerToken / unregisterToken", () => {
  test("register replaces the user's tokens with this one", async () => {
    await service.registerToken(5, "tok");
    expect(t.replaceUserToken).toHaveBeenCalledWith(5, "tok");
  });

  test("unregister deletes by token value only", async () => {
    await service.unregisterToken("tok");
    expect(t.deleteByToken).toHaveBeenCalledWith("tok");
  });
});
