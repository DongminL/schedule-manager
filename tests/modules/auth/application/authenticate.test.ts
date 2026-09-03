/** Application-layer tests: credential verification. Account infra mocked. */
jest.mock("@/modules/account/infrastructure/passwordHasher", () => ({
  hashPassword: jest.fn(),
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

import * as hasher from "@/modules/account/infrastructure/passwordHasher";
import * as userRepo from "@/modules/account/infrastructure/userRepository";
import { verifyCredentials } from "@/modules/auth/application/authenticate";

const repo = userRepo as jest.Mocked<typeof userRepo>;
const pw = hasher as jest.Mocked<typeof hasher>;

const activeUser = {
  id: 7,
  phoneNumber: "01000000000",
  password: "stored-hash",
  name: "점장",
  role: "MANAGER" as const,
  color: "#2563eb",
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

test("unknown phone number → null", async () => {
  repo.findByPhoneNumber.mockResolvedValue(undefined);
  expect(await verifyCredentials("01000000000", "pw")).toBeNull();
  expect(pw.verifyPassword).not.toHaveBeenCalled();
});

test("inactive user → null (even with correct password)", async () => {
  repo.findByPhoneNumber.mockResolvedValue({ ...activeUser, isActive: false });
  pw.verifyPassword.mockResolvedValue(true);
  expect(await verifyCredentials("01000000000", "pw")).toBeNull();
});

test("wrong password → null", async () => {
  repo.findByPhoneNumber.mockResolvedValue(activeUser);
  pw.verifyPassword.mockResolvedValue(false);
  expect(await verifyCredentials("01000000000", "bad")).toBeNull();
});

test("valid → normalized user (id as string, no password)", async () => {
  repo.findByPhoneNumber.mockResolvedValue(activeUser);
  pw.verifyPassword.mockResolvedValue(true);

  const out = await verifyCredentials("01000000000", "good");

  expect(pw.verifyPassword).toHaveBeenCalledWith("good", "stored-hash");
  expect(out).toEqual({
    id: "7",
    name: "점장",
    role: "MANAGER",
    mustChangePassword: false,
  });
});
