
import "server-only";

import { getRedisClient } from "@/lib/redis";

const CACHE_PREFIX = "drug-candidates";
const DEFAULT_TTL_SECONDS = 60;

export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const value = await redis.get<T>(key);

    console.log(
      value !== null ? "[Redis] CACHE HIT:" : "[Redis] CACHE MISS:",
      key,
    );

    return value;
  } catch (error) {
    console.error("[Redis] Cache read failed:", error);
    return null;
  }
}

export async function setCachedValue<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    const redis = getRedisClient();

    await redis.set(key, value, {
      ex: ttlSeconds,
    });
  } catch (error) {
    // Cache failures should not prevent the application from serving data.
    console.error("Redis cache write failed:", error);
  }
}

export async function deleteCachedValue(
  key: string,
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error("Redis cache invalidation failed:", error);
  }
}

export function buildCandidateCacheKey(
  params: Record<string, string | number | undefined>,
): string {
  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${encodeURIComponent(String(value))}`)
    .join(":");

  return `${CACHE_PREFIX}:list:${normalizedParams || "all"}`;
}

export function buildCandidateDetailCacheKey(id: string): string {
  return `${CACHE_PREFIX}:detail:${encodeURIComponent(id)}`;
}
