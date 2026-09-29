/** Parses a `pageNo` search param into a valid 1-based page number, defaulting to 1. */
export function parsePageNo(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
