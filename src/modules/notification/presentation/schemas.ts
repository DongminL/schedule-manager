import { z } from "zod";

export const tokenSchema = z.object({
  token: z.string().min(1).max(512),
});
