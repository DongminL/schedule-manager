jest.mock("@/modules/auth/presentation/guards", () => ({
  requireActiveUser: jest.fn(),
}));
jest.mock("@/modules/notification/application/notificationService", () => ({
  registerToken: jest.fn(),
  unregisterToken: jest.fn(),
}));

import { Errors } from "@/core/http/envelope";
import * as guards from "@/modules/auth/presentation/guards";
import * as service from "@/modules/notification/application/notificationService";
import {
  registerHandler,
  unregisterHandler,
} from "@/modules/notification/presentation/controller";

import { jsonRequest } from "../../../helpers/api";

const g = guards as jest.Mocked<typeof guards>;
const s = service as jest.Mocked<typeof service>;

const STAFF = { id: 5, role: "STAFF" as const, name: "알바", mustChangePassword: false };

describe("POST /api/push-tokens", () => {
  test("registers the token for the session user", async () => {
    g.requireActiveUser.mockResolvedValue(STAFF);
    const res = await registerHandler(
      jsonRequest("/api/push-tokens", { body: { token: "tok" } }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect(s.registerToken).toHaveBeenCalledWith(5, "tok");
  });

  test("unauthenticated → 401", async () => {
    g.requireActiveUser.mockRejectedValue(Errors.unauthorized());
    const res = await registerHandler(
      jsonRequest("/api/push-tokens", { body: { token: "tok" } }),
      undefined,
    );
    expect(res.status).toBe(401);
    expect(s.registerToken).not.toHaveBeenCalled();
  });

  test("empty token → 422", async () => {
    g.requireActiveUser.mockResolvedValue(STAFF);
    const res = await registerHandler(
      jsonRequest("/api/push-tokens", { body: { token: "" } }),
      undefined,
    );
    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/push-tokens", () => {
  test("deletes by token without requiring a session", async () => {
    const res = await unregisterHandler(
      jsonRequest("/api/push-tokens", { method: "DELETE", body: { token: "tok" } }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect(s.unregisterToken).toHaveBeenCalledWith("tok");
    expect(g.requireActiveUser).not.toHaveBeenCalled();
  });

  test("missing token → 422", async () => {
    const res = await unregisterHandler(
      jsonRequest("/api/push-tokens", { method: "DELETE", body: {} }),
      undefined,
    );
    expect(res.status).toBe(422);
  });
});
