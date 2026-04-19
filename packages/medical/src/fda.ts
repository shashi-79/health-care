const BASE_URL = "https://api.fda.gov/drug/label.json";
const DEFAULT_OPENFDA_TIMEOUT_MS = Number(process.env.OPENFDA_TIMEOUT_MS ?? 1800);
const DEFAULT_CACHE_TTL_MS = Number(process.env.OPENFDA_CACHE_TTL_MS ?? 5 * 60 * 1000);
const DEFAULT_FAILURE_COOLDOWN_MS = Number(process.env.OPENFDA_FAILURE_COOLDOWN_MS ?? 20 * 1000);
const MAX_CACHE_ENTRIES = 100;
const GLOBAL_FAILURE_KEY = "__global__";

type FetchDrugDataOptions = {
  timeoutMs?: number;
  cacheTtlMs?: number;
  failureCooldownMs?: number;
};

type CacheEntry = {
  expiresAtMs: number;
  results: any[];
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any[]>>();
const failureCooldownStore = new Map<string, number>();

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCacheKey(query: string, limit: number) {
  return `${normalizeQuery(query)}::${limit}`;
}

function pruneCache(nowMs: number) {
  for (const [key, value] of responseCache.entries()) {
    if (value.expiresAtMs <= nowMs) {
      responseCache.delete(key);
    }
  }

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    responseCache.delete(oldestKey);
  }

  for (const [key, cooldownUntilMs] of failureCooldownStore.entries()) {
    if (cooldownUntilMs <= nowMs) {
      failureCooldownStore.delete(key);
    }
  }
}

function isTransientOpenFdaError(error: unknown) {
  if (!(error instanceof Error)) {
    return true;
  }

  return /timed out|timeout|abort|network|fetch failed|econn|enotfound|eai_again/i.test(error.message);
}

function getRemainingCooldownMs(cacheKey: string, nowMs: number) {
  const queryCooldownMs = (failureCooldownStore.get(cacheKey) ?? 0) - nowMs;
  const globalCooldownMs = (failureCooldownStore.get(GLOBAL_FAILURE_KEY) ?? 0) - nowMs;
  return Math.max(queryCooldownMs, globalCooldownMs, 0);
}

async function fetchFromOpenFda(query: string, limit: number, timeoutMs: number): Promise<any[]> {
  const search = encodeURIComponent(query);
  const url = `${BASE_URL}?search=${search}&limit=${limit}`;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, Math.max(250, timeoutMs));

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`openFDA request failed: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`openFDA request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDrugData(query: string, limit = 5, options: FetchDrugDataOptions = {}) {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(10, Math.floor(limit))) : 5;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(250, Math.floor(options.timeoutMs as number))
    : DEFAULT_OPENFDA_TIMEOUT_MS;
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs)
    ? Math.max(0, Math.floor(options.cacheTtlMs as number))
    : DEFAULT_CACHE_TTL_MS;
  const failureCooldownMs = Number.isFinite(options.failureCooldownMs)
    ? Math.max(0, Math.floor(options.failureCooldownMs as number))
    : DEFAULT_FAILURE_COOLDOWN_MS;

  const cacheKey = buildCacheKey(normalized, safeLimit);
  const nowMs = Date.now();
  pruneCache(nowMs);

  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.results;
  }

  const remainingCooldownMs = getRemainingCooldownMs(cacheKey, nowMs);
  if (remainingCooldownMs > 0) {
    throw new Error(`openFDA temporarily unavailable (${remainingCooldownMs}ms cooldown)`);
  }

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = fetchFromOpenFda(normalized, safeLimit, timeoutMs)
    .then((results) => {
      failureCooldownStore.delete(cacheKey);
      if (cacheTtlMs > 0) {
        responseCache.set(cacheKey, {
          results,
          expiresAtMs: Date.now() + cacheTtlMs
        });
      }
      return results;
    })
    .catch((error) => {
      if (failureCooldownMs > 0) {
        const cooldownUntilMs = Date.now() + failureCooldownMs;
        failureCooldownStore.set(cacheKey, cooldownUntilMs);
        if (isTransientOpenFdaError(error)) {
          failureCooldownStore.set(GLOBAL_FAILURE_KEY, cooldownUntilMs);
        }
      }
      throw error;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
