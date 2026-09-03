import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const apiFailureSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: apiErrorSchema,
});

export function apiSuccessSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
    error: z.null(),
  });
}
