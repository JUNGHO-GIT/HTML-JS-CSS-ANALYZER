/**
 * @file cssCache.ts
 * @since 2025-11-22
 * @description LRU 기반 CSS 선택자 캐시 (TTL, 접근 빈도 기반 정리)
 */

import type { SelectorPos } from "@exportTypes";

// TYPE DEFINITIONS --------------------------------------------------------------------------------
interface CacheEntry {
  accessCount: number;
  data: SelectorPos[];
  size: number;
  timestamp: number;
  version: number;
}
interface CacheConfig {
  maxEntries: number;
  maxMemoryMb: number;
  ttlMs: number;
}

// CONSTANTS ---------------------------------------------------------------------------------------
const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 300,
  ttlMs: 30 * 60 * 1000,
  maxMemoryMb: 50,
};

// CACHE STATE -------------------------------------------------------------------------------------
const styleCache: Map<string, CacheEntry> = new Map();
let config = { ...DEFAULT_CONFIG };
let totalMemoryBytes = 0;

// HELPER FUNCTIONS --------------------------------------------------------------------------------
const estimateSize = (data: SelectorPos[]): number => {
  // 대략적 추정: 선택자 엔트리당 약 100바이트
  return data.length * 100 + 50;
};

const isExpired = (cacheVal: CacheEntry): boolean => Date.now() - cacheVal.timestamp > config.ttlMs;

const isMemoryExceeded = (): boolean => totalMemoryBytes > config.maxMemoryMb * 1024 * 1024;

const needsEviction = (): boolean => styleCache.size > config.maxEntries || isMemoryExceeded();

const touch = (key: string): void => {
  const val = styleCache.get(key);
  if (!val) {
    return;
  }
  val.accessCount++;
  val.timestamp = Date.now();

  // 최근 사용 항목을 끝으로 이동 (LRU 구현)
  styleCache.delete(key);
  styleCache.set(key, val);
};

const removeEntry = (key: string): void => {
  const val = styleCache.get(key);
  if (val) {
    totalMemoryBytes -= val.size;
  }
  styleCache.delete(key);
};

const cleanExpired = (): number => {
  const now = Date.now();
  let removed = 0;

  for (const [key, val] of styleCache.entries()) {
    if (now - val.timestamp > config.ttlMs) {
      removeEntry(key);
      removed++;
    }
  }
  return removed;
};

// 접근 빈도(오름차순), 동률이면 timestamp(오름차순)가 가장 낮은 항목 1개를 제거한다.
const evictLeastUseful = (): boolean => {
  let minKey = ``;
  let minScore = Number.POSITIVE_INFINITY;
  let minTimestamp = Number.POSITIVE_INFINITY;
  for (const [key, val] of styleCache.entries()) {
    if (val.accessCount < minScore || (val.accessCount === minScore && val.timestamp < minTimestamp)) {
      minKey = key;
      minScore = val.accessCount;
      minTimestamp = val.timestamp;
    }
  }
  if (!minKey) {
    return false;
  }
  removeEntry(minKey);
  return true;
};

const ensureLimit = (): void => {
  cleanExpired();

  if (!needsEviction()) {
    return;
  }
  const overCount = Math.max(styleCache.size - config.maxEntries, 0) + 1;

  // 소규모 축출: 엔트리 초과가 작고 메모리 초과가 아닌 경우, 한도 아래로 내려갈 때까지 최소 항목을 반복 제거한다.
  if (overCount <= 5 && !isMemoryExceeded()) {
    while (needsEviction() && styleCache.size > 0) {
      if (!evictLeastUseful()) {
        break;
      }
    }
    return;
  }

  // 대규모 축출: 전체 정렬 후 한도(엔트리 + 메모리) 아래로 내려갈 때까지 제거한다.
  const entries = [...styleCache.entries()].sort((a, b) => {
    const scoreDiff = a[1].accessCount - b[1].accessCount;
    return scoreDiff !== 0 ? scoreDiff : a[1].timestamp - b[1].timestamp;
  });

  let i = 0;
  while (needsEviction() && i < entries.length) {
    removeEntry(entries[i][0]);
    i++;
  }
};

// PUBLIC API --------------------------------------------------------------------------------------
export const cacheGet = (key: string): CacheEntry | undefined => {
  const val = styleCache.get(key);
  if (!val) {
    return undefined;
  }
  if (isExpired(val)) {
    removeEntry(key);
    return undefined;
  }
  touch(key);
  return val;
};

export const cacheSet = (key: string, value: Omit<CacheEntry, `timestamp` | `accessCount` | `size`>): void => {
  // 갱신 시 기존 항목을 먼저 제거하여 메모리 카운트를 정확히 유지한다.
  if (styleCache.has(key)) {
    removeEntry(key);
  }

  ensureLimit();

  const size = estimateSize(value.data);
  const enrichedEntry: CacheEntry = {
    ...value,
    timestamp: Date.now(),
    accessCount: 1,
    size,
  };

  styleCache.set(key, enrichedEntry);
  totalMemoryBytes += size;
};

export const cacheDelete = (key: string): boolean => {
  const existed = styleCache.has(key);
  if (existed) {
    removeEntry(key);
  }
  return existed;
};

export const cacheClear = (): void => {
  styleCache.clear();
  totalMemoryBytes = 0;
};

export const cacheSize = (): number => styleCache.size;

export const cacheStats = (): {
  entries: number;
  maxEntries: number;
  memoryMb: number;
  maxMemoryMb: number;
  ttlMs: number;
  hitRate?: number;
} => ({
  entries: styleCache.size,
  maxEntries: config.maxEntries,
  memoryMb: Math.round((totalMemoryBytes / 1024 / 1024) * 100) / 100,
  maxMemoryMb: config.maxMemoryMb,
  ttlMs: config.ttlMs,
});

export const cacheConfig = (newConfig: Partial<CacheConfig>): void => {
  config = { ...config, ...newConfig };
  ensureLimit();
};

export const cacheCleanup = (): number => cleanExpired();
