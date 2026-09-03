import { Errors, ok, parseIdParam, readJson, route } from "@/core/http/envelope";
import {
  requireActiveUser,
  requireManager,
  requireUser,
} from "@/modules/auth/presentation/guards";

import {
  changePassword,
  createStaff,
  deactivateStaff,
  getStaff,
  listActiveRoster,
  listStaff,
  updateStaff,
} from "../application/accountService";
import { changePasswordSchema, createStaffSchema, updateStaffSchema } from "./schemas";

type IdCtx = { params: Promise<{ id: string }> };

const idOf = async (ctx: IdCtx): Promise<number> =>
  parseIdParam((await ctx.params).id, "직원 ID");

export const listStaffHandler = route(async (req) => {
  await requireManager();
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true";
  return ok(await listStaff(includeInactive));
});

export const rosterHandler = route(async () => {
  await requireActiveUser();
  return ok(await listActiveRoster());
});

export const createStaffHandler = route(async (req) => {
  await requireManager();
  return ok(await createStaff(await readJson(req, createStaffSchema)), { status: 201 });
});

export const getStaffHandler = route<IdCtx>(async (_req, ctx) => {
  await requireManager();
  return ok(await getStaff(await idOf(ctx)));
});

export const updateStaffHandler = route<IdCtx>(async (req, ctx) => {
  await requireManager();
  return ok(await updateStaff(await idOf(ctx), await readJson(req, updateStaffSchema)));
});

export const deactivateStaffHandler = route<IdCtx>(async (_req, ctx) => {
  await requireManager();
  return ok(await deactivateStaff(await idOf(ctx)));
});

export const changePasswordHandler = route(async (req) => {
  const session = await requireUser();
  // Only serves the forced first-login change. A session whose flag is already
  // cleared has no old-password check guarding it, so reject rather than allow
  // a no-verification reset.
  if (!session.mustChangePassword) {
    throw Errors.badRequest("비밀번호 변경이 필요하지 않습니다.");
  }
  const { newPassword } = await readJson(req, changePasswordSchema);
  await changePassword(session.id, newPassword);
  // Client should call `useSession().update({ mustChangePassword: false })` next.
  return ok({ mustChangePassword: false });
});
