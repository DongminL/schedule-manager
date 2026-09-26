import { REQUEST_STATUS, type RequestStatus } from "@/core/db/schema";
import { ok, parseIdParam, readJson, route } from "@/core/http/envelope";
import { requireActiveManager, requireActiveUser } from "@/modules/auth/presentation/guards";

import { approveChangeRequest, rejectChangeRequest } from "../application/approvalService";
import { notifyRequestEvent } from "../application/requestNotifier";
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
  const created = await createChangeRequest(user.id, input);
  notifyRequestEvent("CREATED", created);
  return ok(created, { status: 201 });
});

export const detailHandler = route<Ctx>(async (_req, ctx) => {
  const user = await requireActiveUser();
  return ok(await getChangeRequestDetail(await requestId(ctx), user));
});

export const peerAcceptHandler = route<Ctx>(async (_req, ctx) => {
  const user = await requireActiveUser();
  const accepted = await peerAccept(await requestId(ctx), user.id);
  notifyRequestEvent("PEER_ACCEPTED", accepted);
  return ok(accepted);
});

export const peerRejectHandler = route<Ctx>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { reason } = await readJson(req, peerRejectSchema);
  const rejected = await peerReject(await requestId(ctx), user.id, reason);
  notifyRequestEvent("PEER_REJECTED", rejected);
  return ok(rejected);
});

export const approveHandler = route<Ctx>(async (req, ctx) => {
  const manager = await requireActiveManager();
  const body = await req.json().catch(() => ({}));
  const { version } = approveSchema.parse(body);
  const { request } = await approveChangeRequest(manager.id, await requestId(ctx), version);
  notifyRequestEvent("APPROVED", request);
  return ok(request);
});

export const rejectHandler = route<Ctx>(async (req, ctx) => {
  const manager = await requireActiveManager();
  const { rejectReason, version } = await readJson(req, rejectSchema);
  const rejected = await rejectChangeRequest(
    manager.id,
    await requestId(ctx),
    rejectReason,
    version,
  );
  notifyRequestEvent("MANAGER_REJECTED", rejected);
  return ok(rejected);
});
