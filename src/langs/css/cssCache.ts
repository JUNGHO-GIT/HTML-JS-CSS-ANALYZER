/**
 * @file cssCache.ts
 * @since 2025-11-22
 * @description LRU 기반 CSS 선택자 캐시 (TTL, 접근 빈도 기반 정리)
 */

import type { SelectorPos } from "@exportTypes";

// TYPE DEFINITIONS --------------------------------------------------------------------------------
interface CacheVal {
  version: number;
  data: SelectorPos[];
  timestamp: number;
  accessCount: number;
  size: number;
}

interface CacheConfig {
  maxEntries: number;
  ttlMs: number;
  maxMemoryMb: number;
}

// CONSTANTS ---------------------------------------------------------------------------------------
const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 300,
  ttlMs: 30 * 60 * 1000,
  maxMemoryMb: 50,
};

// CACHE STATE -------------------------------------------------------------------------------------
const styleCache: Map<string, CacheVal> = new Map();
let config = { ...DEFAULT_CONFIG };
let totalMemoryBytes = 0;

// HELPER FUNCTIONS --------------------------------------------------------------------------------
const estimateSize = (data: SelectorPos[]): number => {
  // Rough estimation: each selector entry ~100 bytes
  return data.length * 100 + 50;
};

const isExpired = (cacheVal: CacheVal): boolean => Date.now() - cacheVal.timestamp > config.ttlMs;

const isMemoryExceeded = (): boolean => totalMemoryBytes > config.maxMemoryMb * 1024 * 1024;

const touch = (key: string): void => {
  const val = styleCache.get(key);
  if (!val) {
    return;
  }
  val.accessCount++;
  val.timestamp = Date.now();

  // Move to end (LRU implementation)
  styleCache.delete(key);
  styleCache.set(key, val);
};

const removeEntry = (key: string): void => {
  const val = styleCache.get(key);
  val && (totalMemoryBytes -= val.size);
  styleCache.delete(key);
};

const cleanExpired = (): number => {
  const now = Date.now();
  let removed = 0;

  for (const [ key, val ] of styleCache.entries()) {
    now - val.timestamp > config.ttlMs && (removeEntry(key), removed++);
  }

  return removed;
};

const ensureLimit = (): void => {
  cleanExpired();

  const needsEviction = styleCache.size > config.maxEntries || isMemoryExceeded();
  if (!needsEviction) {
    return;
  }
  // Sort by priority: low access count + old timestamp = evict first
  const entries = [...styleCache.entries()].sort((a, b) => {
    const scoreDiff = a[1].accessCount - b[1].accessCount;
    return scoreDiff !== 0 ? scoreDiff : a[1].timestamp - b[1].timestamp;
  });

  // Remove until within limits
  let i = 0;
  while ((styleCache.size > config.maxEntries || isMemoryExceeded()) && i < entries.length) {
    removeEntry(entries[i][0]);
    i++;
  }
};

// PUBLIC API --------------------------------------------------------------------------------------
export const cacheGet = (key: string): CacheVal | undefined => {
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

export const cacheSet = (key: string, value: Omit<CacheVal, `timestamp` | `accessCount` | `size`>): void => {
  // Remove existing entry first if updating
  styleCache.has(key) && removeEntry(key);

  ensureLimit();

  const size = estimateSize(value.data);
  const enrichedValue: CacheVal = {
    ...value,
    timestamp: Date.now(),
    accessCount: 1,
    size,
  };

  styleCache.set(key, enrichedValue);
  totalMemoryBytes += size;
};

export const cacheDelete = (key: string): boolean => {
  const existed = styleCache.has(key);
  existed && removeEntry(key);
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
