/** Application-layer tests: account service. Infrastructure (repo + hasher) mocked. */
jest.mock("@/modules/account/infrastructure/passwordHasher", () => ({
  hashPassword: jest.fn(async (p: string) => `hash:${p}`),
  verifyPassword: jest.fn(),
}));
jest.mock("@/modules/account/infrastructure/userRepository", () => ({
  findById: jest.fn(),
  findByPhoneNumber: jest.fn(),
  list: jest.fn(),
  phoneNumberTakenByOther: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
}));

import * as accountService from "@/modules/account/application/accountService";
import * as hasher from "@/modules/account/infrastructure/passwordHasher";
import * as userRepo from "@/modules/account/infrastructure/userRepository";

const repo = userRepo as jest.Mocked<typeof userRepo>;
const pw = hasher as jest.Mocked<typeof hasher>;

const userRow = {
  id: 2,
  phoneNumber: "01000000000",
  password: "stored-hash",
  name: "알바",
  role: "STAFF" as const,
  color: "#cccccc",
  isActive: true,
  mustChangePassword: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("listStaff", () => {
  test("passes includeInactive through and strips the password", async () => {
    repo.list.mockResolvedValue([userRow]);
    const out = await accountService.listStaff(true);
    expect(repo.list).toHaveBeenCalledWith(true);
    expect(out[0]).not.toHaveProperty("password");
    expect(out[0]).toMatchObject({ id: 2, name: "알바" });
  });

  test("defaults includeInactive to false", async () => {
    repo.list.mockResolvedValue([]);
    await accountService.listStaff();
    expect(repo.list).toHaveBeenCalledWith(false);
  });
});

describe("listContactDirectory", () => {
  test("returns active users with phone number and role, never the password", async () => {
    repo.list.mockResolvedValue([userRow]);
    const out = await accountService.listContactDirectory();
    expect(repo.list).toHaveBeenCalledWith(false);
    expect(out).toEqual([
      { id: 2, name: "알바", role: "STAFF", phoneNumber: "01000000000" },
    ]);
  });
});

describe("getStaff", () => {
  test("returns the public user", async () => {
    repo.findById.mockResolvedValue(userRow);
    expect(await accountService.getStaff(2)).not.toHaveProperty("password");
  });

  test("missing → NOT_FOUND", async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(accountService.getStaff(2)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("createStaff", () => {
  test("temp password = phone, STAFF role, mustChangePassword true", async () => {
    repo.findByPhoneNumber.mockResolvedValue(undefined);
    repo.insert.mockImplementation(async (v) => ({ ...userRow, ...v, id: 9 }));

    const out = await accountService.createStaff({ name: "새직원", phoneNumber: "01022223333" });

    expect(pw.hashPassword).toHaveBeenCalledWith("01022223333");
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "새직원",
        phoneNumber: "01022223333",
        password: "hash:01022223333",
        role: "STAFF",
        mustChangePassword: true,
        color: "#cccccc",
      }),
    );
    expect(out).not.toHaveProperty("password");
  });

  test("duplicate phone → CONFLICT", async () => {
    repo.findByPhoneNumber.mockResolvedValue(userRow);
    await expect(
      accountService.createStaff({ name: "x", phoneNumber: "01000000000" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    expect(repo.insert).not.toHaveBeenCalled();
  });
});

describe("updateStaff", () => {
  test("phone taken by another user → CONFLICT", async () => {
    repo.phoneNumberTakenByOther.mockResolvedValue(true);
    await expect(
      accountService.updateStaff(2, { phoneNumber: "01099998888" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("missing row → NOT_FOUND", async () => {
    repo.update.mockResolvedValue(undefined);
    await expect(accountService.updateStaff(2, { name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("ok → returns public user", async () => {
    repo.update.mockResolvedValue({ ...userRow, name: "바뀐이름" });
    const out = await accountService.updateStaff(2, { name: "바뀐이름" });
    expect(out.name).toBe("바뀐이름");
    expect(out).not.toHaveProperty("password");
  });
});

describe("deactivateStaff", () => {
  test("missing → NOT_FOUND", async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(accountService.deactivateStaff(2)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("MANAGER cannot be deactivated → BAD_REQUEST", async () => {
    repo.findById.mockResolvedValue({ ...userRow, role: "MANAGER" });
    await expect(accountService.deactivateStaff(1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("soft delete via isActive=false", async () => {
    repo.findById.mockResolvedValue(userRow);
    repo.update.mockResolvedValue({ ...userRow, isActive: false });
    const out = await accountService.deactivateStaff(2);
    expect(repo.update).toHaveBeenCalledWith(2, { isActive: false });
    expect(out.isActive).toBe(false);
  });
});

describe("changePassword", () => {
  test("user missing → NOT_FOUND", async () => {
    repo.findById.mockResolvedValue(undefined);
    await expect(accountService.changePassword(2, "newpass12")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("new password same as current → BAD_REQUEST", async () => {
    repo.findById.mockResolvedValue(userRow);
    pw.verifyPassword.mockResolvedValue(true);
    await expect(accountService.changePassword(2, "newpass12")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  test("ok → hashes new password and clears mustChangePassword", async () => {
    repo.findById.mockResolvedValue(userRow);
    pw.verifyPassword.mockResolvedValue(false);
    repo.update.mockResolvedValue(userRow);

    await accountService.changePassword(2, "newpass12");

    expect(pw.hashPassword).toHaveBeenCalledWith("newpass12");
    expect(repo.update).toHaveBeenCalledWith(2, {
      password: "hash:newpass12",
      mustChangePassword: false,
    });
  });
});
