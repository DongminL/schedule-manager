import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "VERSION_CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: () => new AppError("UNAUTHORIZED", "로그인이 필요합니다.", 401),
  forbidden: (message = "권한이 없습니다.") => new AppError("FORBIDDEN", message, 403),
  passwordChangeRequired: () =>
    new AppError("PASSWORD_CHANGE_REQUIRED", "최초 로그인 시 비밀번호를 변경해야 합니다.", 403),
  notFound: (what = "리소스") => new AppError("NOT_FOUND", `${what}를 찾을 수 없습니다.`, 404),
  validation: (details: unknown) =>
    new AppError("VALIDATION", "입력값이 올바르지 않습니다.", 422, details),
  badRequest: (message: string, details?: unknown) =>
    new AppError("BAD_REQUEST", message, 400, details),
  conflict: (message: string, details?: unknown) =>
    new AppError("CONFLICT", message, 409, details),
  versionConflict: () =>
    new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 시도하세요.",
      409,
    ),
} as const;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}
export interface ApiFailure {
  success: false;
  data: null;
  error: { code: ErrorCode; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ success: true, data, error: null } satisfies ApiSuccess<T>, init);
}

export function fail(error: AppError): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: { code: error.code, message: error.message, details: error.details },
    } satisfies ApiFailure,
    { status: error.status },
  );
}

/** Postgres unique-violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(e: unknown): e is { code: string; constraint_name?: string } {
  return (
    typeof e === "object" && e !== null && (e as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

type RouteHandler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

/** Wrap a route handler so thrown `AppError` / `ZodError` become envelopes. */
export function route<Ctx = unknown>(handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof AppError) return fail(e);
      if (e instanceof ZodError) return fail(Errors.validation(e.flatten()));
      if (isUniqueViolation(e)) {
        return fail(Errors.conflict("이미 존재하거나 처리 중인 요청입니다.", e.constraint_name));
      }
       
      console.error("[route] unhandled error", e);
      return fail(new AppError("INTERNAL", "서버 오류가 발생했습니다.", 500));
    }
  };
}

/** Parse a positive-integer route param (`label` names it in the error). */
export function parseIdParam(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw Errors.badRequest(`잘못된 ${label}입니다.`);
  return n;
}

/** Parse and validate a JSON body, throwing a ZodError the wrapper will format. */
export async function readJson<T>(
  req: Request,
  schema: { parse: (v: unknown) => T },
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.badRequest("요청 본문이 올바른 JSON이 아닙니다.");
  }
  return schema.parse(raw);
}
