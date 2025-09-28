// src/langs/css/cssCache.ts

import {type SelectorPos} from "../types/common.js";

// -------------------------------------------------------------------------------------------------
type CacheVal = {
	version: number;
	data: SelectorPos[];
	timestamp: number;
	accessCount: number;
};

const styleCache: Map<string, CacheVal> = new Map();
const MAX_CACHE = 300; // Increased for better performance
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

// -------------------------------------------------------------------------------------------------
const isExpired = (cacheVal: CacheVal): boolean => {
	return (Date.now() - cacheVal.timestamp) > CACHE_TTL_MS;
};

// -------------------------------------------------------------------------------------------------
const touch = (key: string): void => {
	const val = styleCache.get(key);
	if (!val) {
		return;
	}

	// Update access statistics
	val.accessCount++;
	val.timestamp = Date.now();

	// Move to end (LRU implementation)
	styleCache.delete(key);
	styleCache.set(key, val);
};

// -------------------------------------------------------------------------------------------------
const cleanExpired = (): void => {
	const now = Date.now();
	const expiredKeys: string[] = [];

	for (const [key, val] of styleCache.entries()) {
		if ((now - val.timestamp) > CACHE_TTL_MS) {
			expiredKeys.push(key);
		}
	}

	expiredKeys.forEach(key => styleCache.delete(key));
};

// -------------------------------------------------------------------------------------------------
const ensureLimit = (): void => {
	// Clean expired entries first
	cleanExpired();

	if (styleCache.size <= MAX_CACHE) {
		return;
	}

	// Remove LRU entries based on access patterns
	const entries = Array.from(styleCache.entries());
	entries.sort((a, b) => {
		// Sort by access count (ascending) then by timestamp (ascending)
		const accessDiff = a[1].accessCount - b[1].accessCount;
		return accessDiff !== 0 ? accessDiff : a[1].timestamp - b[1].timestamp;
	});

	const toRemove = Math.ceil(styleCache.size * 0.2); // Remove 20% of cache
	for (let i = 0; i < toRemove && styleCache.size > MAX_CACHE; i++) {
		styleCache.delete(entries[i][0]);
	}
};

// -------------------------------------------------------------------------------------------------
export const cacheGet = (key: string): CacheVal | undefined => {
	const val = styleCache.get(key);
	if (!val) {
		return undefined;
	}

	// Check if expired
	if (isExpired(val)) {
		styleCache.delete(key);
		return undefined;
	}

	touch(key);
	return val;
};

// -------------------------------------------------------------------------------------------------
export const cacheSet = (key: string, value: Omit<CacheVal, 'timestamp' | 'accessCount'>): void => {
	ensureLimit();

	const enrichedValue: CacheVal = {
		...value,
		timestamp: Date.now(),
		accessCount: 1
	};

	styleCache.set(key, enrichedValue);
};

// -------------------------------------------------------------------------------------------------
export const cacheDelete = (key: string): boolean => {
	return styleCache.delete(key);
};

// -------------------------------------------------------------------------------------------------
export const cacheClear = (): void => {
	styleCache.clear();
};

// -------------------------------------------------------------------------------------------------
export const cacheSize = (): number => {
	return styleCache.size;
};

// -------------------------------------------------------------------------------------------------
export const cacheStats = (): {size: number; maxSize: number; ttlMs: number} => {
	return {
		size: styleCache.size,
		maxSize: MAX_CACHE,
		ttlMs: CACHE_TTL_MS
	};
};
