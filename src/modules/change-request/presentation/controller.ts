import { REQUEST_STATUS, type RequestStatus } from "@/core/db/schema";
import { ok, parseIdParam, readJson, route } from "@/core/http/envelope";
import { requireActiveManager, requireActiveUser } from "@/modules/auth/presentation/guards";

import { approveChangeRequest, rejectChangeRequest } from "../application/approvalService";
import {
  createChangeRequest,
  getChangeRequestDetail,
  listChangeRequests,
  peerAccept,
  peerReject,
} from "../application/changeRequestService";
import type { CreateChangeRequestInput } from "../domain/types";
import { approveSchema, parseChangeRequest, peerRejectSchema, rejectSchema } from "./schemas";

type Ctx = { params: Promise<{ id: string }> };

const requestId = async (ctx: Ctx): Promise<number> =>
  parseIdParam((await ctx.params).id, "요청 ID");

export const listHandler = route(async (req) => {
  const user = await requireActiveUser();
  const raw = new URL(req.url).searchParams.get("status");
  const status = REQUEST_STATUS.includes(raw as RequestStatus)
    ? (raw as RequestStatus)
    : undefined;
  return ok(await listChangeRequests(user, status));
});

export const createHandler = route(async (req) => {
  const user = await requireActiveUser();
  const input = (await readJson(req, { parse: parseChangeRequest })) as CreateChangeRequestInput;
  return ok(await createChangeRequest(user.id, input), { status: 201 });
});

export const detailHandler = route<Ctx>(async (_req, ctx) => {
  const user = await requireActiveUser();
  return ok(await getChangeRequestDetail(await requestId(ctx), user));
});

export const peerAcceptHandler = route<Ctx>(async (_req, ctx) => {
  const user = await requireActiveUser();
  return ok(await peerAccept(await requestId(ctx), user.id));
});

export const peerRejectHandler = route<Ctx>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { reason } = await readJson(req, peerRejectSchema);
  return ok(await peerReject(await requestId(ctx), user.id, reason));
});

export const approveHandler = route<Ctx>(async (req, ctx) => {
  const manager = await requireActiveManager();
  const body = await req.json().catch(() => ({}));
  const { version } = approveSchema.parse(body);
  const { request } = await approveChangeRequest(manager.id, await requestId(ctx), version);
  return ok(request);
});

export const rejectHandler = route<Ctx>(async (req, ctx) => {
  const manager = await requireActiveManager();
  const { rejectReason, version } = await readJson(req, rejectSchema);
  return ok(await rejectChangeRequest(manager.id, await requestId(ctx), rejectReason, version));
});
