import { auth } from "@/modules/auth";
import type { Role } from "@/core/db/schema";

import { Errors } from "@/core/http/envelope";

export interface SessionUser {
  id: number;
  role: Role;
  name: string;
  mustChangePassword: boolean;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!session?.user || !Number.isInteger(id) || id <= 0) throw Errors.unauthorized();
  return {
    id,
    role: session.user.role,
    name: session.user.name ?? "",
    mustChangePassword: session.user.mustChangePassword,
  };
}

export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "MANAGER") throw Errors.forbidden();
  return user;
}

/** Blocks mutations until the forced first-login password change is done. */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.mustChangePassword) throw Errors.passwordChangeRequired();
  return user;
}

export async function requireActiveManager(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (user.role !== "MANAGER") throw Errors.forbidden();
  return user;
}
