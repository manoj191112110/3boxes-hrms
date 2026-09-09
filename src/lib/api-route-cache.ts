/**
 * In-memory GET response cache for hot API routes.
 * Cuts repeat requests from seconds to milliseconds within the TTL window.
 */

type CacheEntry<T> = { value: T; at: number };

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function getCachedResponse<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() - entry.at > ttlMs) return null;
  return entry.value as T;
}

export function setCachedResponse<T>(key: string, value: T): void {
  store.set(key, { value, at: Date.now() });
}

export async function withRouteCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = getCachedResponse<T>(key, ttlMs);
  if (cached !== null) return cached;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = loader()
    .then((value) => {
      setCachedResponse(key, value);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
