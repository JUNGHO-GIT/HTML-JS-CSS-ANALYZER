// src/langs/css/cssCache.ts

import {type SelectorPos} from "../types/common.js";

// -------------------------------------------------------------------------------------------------
type CacheVal = {version: number; data: SelectorPos[];};
const styleCache: Map<string, CacheVal> = new Map();
const MAX_CACHE = 200;

// -------------------------------------------------------------------------------------------------
const touch = (key: string) => {
	if (!styleCache.has(key)) {
		return;
	}
	const val = styleCache.get(key)!;
	styleCache.delete(key);
	styleCache.set(key, val);
};

// -------------------------------------------------------------------------------------------------
const ensureLimit = () => {
	if (styleCache.size <= MAX_CACHE) {
		return;
	}
	const first = styleCache.keys().next().value as string | undefined;
	if (first) {
		styleCache.delete(first);
	}
};

// -------------------------------------------------------------------------------------------------
export const cacheGet = (key: string): CacheVal | undefined => {
	const v = styleCache.get(key);
	if (v) {
		touch(key);
	}
	return v;
};

// -------------------------------------------------------------------------------------------------
export const cacheSet = (key: string, value: CacheVal) => {
	ensureLimit();
	styleCache.set(key, value);
};

// -------------------------------------------------------------------------------------------------
export const cacheDelete = (key: string) => {
	styleCache.delete(key);
};

// -------------------------------------------------------------------------------------------------
export const cacheClear = () => {
	styleCache.clear();
};

// -------------------------------------------------------------------------------------------------
export const cacheSize = () => styleCache.size;
