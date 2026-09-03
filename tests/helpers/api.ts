import type { z } from "zod";

import { apiFailureSchema, apiSuccessSchema } from "@/core/http/apiSchema";

export function jsonRequest(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Request {
  const hasBody = init.body !== undefined;
  return new Request(`http://test.local${path}`, {
    method: init.method ?? (hasBody ? "POST" : "GET"),
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
}

/** Build the Next.js route-handler context ({ params: Promise<...> }). */
export function routeCtx<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}

export async function expectOk<T extends z.ZodTypeAny>(
  res: Response,
  dataSchema: T,
  status = 200,
): Promise<z.infer<T>> {
  const body = await res.json();
  expect({ status: res.status, body }).toMatchObject({ status });
  const parsed = apiSuccessSchema(dataSchema).parse(body);
  return parsed.data as z.infer<T>;
}

export async function expectFail(
  res: Response,
  code: string,
  status: number,
): Promise<void> {
  const body = await res.json();
  expect({ status: res.status, body }).toMatchObject({ status });
  const parsed = apiFailureSchema.parse(body);
  expect(parsed.error.code).toBe(code);
}
