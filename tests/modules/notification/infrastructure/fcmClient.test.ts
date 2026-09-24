const sendEachForMulticast = jest.fn();
let apps: unknown[] = [];

jest.mock("firebase-admin/app", () => ({
  cert: jest.fn((c: unknown) => c),
  getApps: () => apps,
  initializeApp: jest.fn(() => {
    apps = [{}];
    return apps[0];
  }),
}));
jest.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast }),
}));

import { sendToTokens } from "@/modules/notification/infrastructure/fcmClient";

const payload = { title: "변경 요청", body: "본문", url: "/requests/1" };

const ENV_KEYS = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const;

beforeEach(() => {
  apps = [];
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("sendToTokens", () => {
  test("is a no-op (no dead tokens) when Firebase credentials are missing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(sendToTokens(["a"], payload)).resolves.toEqual([]);
    expect(sendEachForMulticast).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  describe("when configured", () => {
    beforeEach(() => {
      process.env.FIREBASE_PROJECT_ID = "p";
      process.env.FIREBASE_CLIENT_EMAIL = "e@p.iam";
      process.env.FIREBASE_PRIVATE_KEY = "line1\\nline2";
    });

    test("sends a data-only message and returns only permanently dead tokens", async () => {
      sendEachForMulticast.mockResolvedValue({
        responses: [
          { success: true },
          { success: false, error: { code: "messaging/registration-token-not-registered" } },
          { success: false, error: { code: "messaging/internal-error" } },
          { success: false, error: { code: "messaging/invalid-argument" } },
        ],
      });

      const dead = await sendToTokens(["ok", "gone", "flaky", "bad"], payload);

      expect(dead).toEqual(["gone", "bad"]);
      expect(sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ["ok", "gone", "flaky", "bad"],
          data: { title: "변경 요청", body: "본문", url: "/requests/1" },
        }),
      );
    });

    test("turns escaped \\n in the private key into real newlines", async () => {
      sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }] });
      const { cert } = jest.requireMock("firebase-admin/app") as { cert: jest.Mock };

      await sendToTokens(["a"], payload);

      expect(cert).toHaveBeenCalledWith(
        expect.objectContaining({ privateKey: "line1\nline2" }),
      );
    });
  });
});
