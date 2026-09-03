import { z } from "zod";

import { ROLES } from "@/core/db/schema";
import { hexColor, password, phoneNumber } from "@/core/validation/primitives";

export const loginSchema = z.object({
  phoneNumber,
  password: z.string().min(1),
});

// Forced first-login change only: the user just authenticated, so no
// current-password re-entry. "Same as old password" is checked server-side
// against the stored hash (see accountService.changePassword).
export const changePasswordSchema = z.object({
  newPassword: password,
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(50),
  phoneNumber,
  color: hexColor.optional(),
});

export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    phoneNumber: phoneNumber.optional(),
    color: hexColor.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 값이 없습니다." });

/* ----------------------------------------------------- response DTOs -- */

/** A staff/manager user as returned by the API (password stripped; timestamps
 *  are ISO strings after JSON serialisation). */
export const publicUserResponse = z.object({
  id: z.number().int().positive(),
  phoneNumber: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  color: z.string(),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const staffListResponse = z.array(publicUserResponse);

/** Active-user directory entry (GET /api/coworkers) — id/name/color only. */
export const rosterEntryResponse = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  color: z.string(),
});

export const rosterListResponse = z.array(rosterEntryResponse);

export const changePasswordResponse = z.object({
  mustChangePassword: z.literal(false),
});
