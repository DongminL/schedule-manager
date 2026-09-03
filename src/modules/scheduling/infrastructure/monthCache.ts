import Redis from "ioredis";

const url = process.env.REDIS_URL;

const globalForRedis = globalThis as unknown as { __redis?: Redis | null };

const redis: Redis | null =
  globalForRedis.__redis ??
  (url
    ? new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
    : null);

if (redis && process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis;
}

const TTL_SECONDS = 60 * 60;
const key = (yyyymm: string) => `schedule:v1:${yyyymm}`;

export async function getMonthCache(yyyymm: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get(key(yyyymm));
  } catch {
    return null;
  }
}

export async function setMonthCache(yyyymm: string, json: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key(yyyymm), json, "EX", TTL_SECONDS);
  } catch {
    // cache is best-effort
  }
}

/** Delete the given month keys. Call after any schedule-mutating transaction commits. */
export async function invalidateMonths(months: Iterable<string>): Promise<void> {
  if (!redis) return;
  const keys = [...new Set(months)].map(key);
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // best-effort; stale entries expire via TTL
  }
}

/**
 * Invalidate a rolling window of month keys starting at `fromDate`'s month.
 * Used for recurring-pattern edits, which affect every future month. The window
 * is bounded (default 24 months) because the cache never holds further out than
 * the max query range anyway.
 */
export async function invalidateFrom(fromDate: string, months = 24): Promise<void> {
  if (!redis) return;
  const [y, m] = fromDate.split("-").map(Number) as [number, number, number];
  const keys: string[] = [];
  let year = y;
  let month = m;
  for (let i = 0; i < months; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  await invalidateMonths(keys);
}
