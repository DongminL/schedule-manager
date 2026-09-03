import { Errors } from "@/core/http/envelope";

import type { Role } from "../domain/tables";
import { toPublicUser, type PublicUser } from "../domain/user";
import { hashPassword, verifyPassword } from "../infrastructure/passwordHasher";
import * as userRepo from "../infrastructure/userRepository";

export interface CreateStaffInput {
  name: string;
  phoneNumber: string;
  color?: string;
}

export interface UpdateStaffInput {
  name?: string;
  phoneNumber?: string;
  color?: string;
  isActive?: boolean;
}

export async function listStaff(includeInactive = false): Promise<PublicUser[]> {
  const rows = await userRepo.list(includeInactive);
  return rows.map(toPublicUser);
}

export interface RosterEntry {
  id: number;
  name: string;
  color: string;
}

/** Minimal directory of active users — safe for any authenticated user to read
 *  (no phone number / status). Used by the calendar and the substitute/peer
 *  pickers in change-request forms. */
export async function listActiveRoster(): Promise<RosterEntry[]> {
  const rows = await userRepo.list(false);
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export interface ContactEntry {
  id: number;
  name: string;
  role: Role;
  phoneNumber: string;
}

/** Full contact directory — every active user's phone number, readable by any
 *  authenticated user. Powers the /contacts screen so staff can reach each
 *  other to arrange a shift change before filing a request. Unlike
 *  `listActiveRoster`, this carries the phone number, so only pass it to screens
 *  that actually show contact info. */
export async function listContactDirectory(): Promise<ContactEntry[]> {
  const rows = await userRepo.list(false);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    phoneNumber: r.phoneNumber,
  }));
}

export async function getStaff(id: number): Promise<PublicUser> {
  const row = await userRepo.findById(id);
  if (!row) throw Errors.notFound("직원");
  return toPublicUser(row);
}

export async function createStaff(input: CreateStaffInput): Promise<PublicUser> {
  if (await userRepo.findByPhoneNumber(input.phoneNumber)) {
    throw Errors.conflict("이미 등록된 휴대폰 번호입니다.");
  }
  // Temp password == phone number; forced change on first login.
  const row = await userRepo.insert({
    name: input.name,
    phoneNumber: input.phoneNumber,
    password: await hashPassword(input.phoneNumber),
    role: "STAFF",
    color: input.color ?? "#cccccc",
    mustChangePassword: true,
  });
  return toPublicUser(row);
}

export async function updateStaff(id: number, patch: UpdateStaffInput): Promise<PublicUser> {
  if (patch.phoneNumber && (await userRepo.phoneNumberTakenByOther(patch.phoneNumber, id))) {
    throw Errors.conflict("이미 등록된 휴대폰 번호입니다.");
  }
  const row = await userRepo.update(id, patch);
  if (!row) throw Errors.notFound("직원");
  return toPublicUser(row);
}

/** Soft delete: keep the row for referential integrity of past shifts. */
export async function deactivateStaff(id: number): Promise<PublicUser> {
  const target = await userRepo.findById(id);
  if (!target) throw Errors.notFound("직원");
  if (target.role === "MANAGER") throw Errors.badRequest("매니저 계정은 비활성화할 수 없습니다.");
  const row = await userRepo.update(id, { isActive: false });
  return toPublicUser(row!);
}

/**
 * Forced first-login change. The caller (changePasswordHandler) has already
 * verified the session and the `mustChangePassword` flag, so no current-password
 * re-entry — the user authenticated moments ago.
 */
export async function changePassword(userId: number, newPassword: string): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw Errors.notFound("사용자");
  if (await verifyPassword(newPassword, user.password)) {
    throw Errors.badRequest("새 비밀번호가 기존 비밀번호와 같습니다.");
  }
  await userRepo.update(userId, {
    password: await hashPassword(newPassword),
    mustChangePassword: false,
  });
}
