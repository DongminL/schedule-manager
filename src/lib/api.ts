import type { ErrorCode } from "@/core/http/envelope";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("NETWORK", "서버에 연결할 수 없습니다.", 0);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // fall through to status-based error below
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error?.code ?? "INTERNAL",
      body?.error?.message ?? "요청을 처리하지 못했습니다.",
      res.status,
      body?.error?.details,
    );
  }
  return body.data as T;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);

export const apiSend = <T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
