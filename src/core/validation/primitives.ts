import { z } from "zod";

export const phoneNumber = z
  .string()
  .trim()
  .regex(/^0\d{9,10}$/, "휴대폰 번호는 숫자 10~11자리여야 합니다.");

export const password = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72);

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "색상은 #RRGGBB 형식이어야 합니다.");

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 HH:MM 형식이어야 합니다.");

/** ISO instant, coerced to Date. */
export const instant = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const idParam = z.coerce.number().int().positive();
