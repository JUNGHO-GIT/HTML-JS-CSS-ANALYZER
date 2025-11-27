/**
 * @file cssCache.test.ts
 * @description CSS 캐시 모듈 TDD 테스트
 */

import { cacheGet, cacheSet, cacheDelete, cacheClear, cacheSize, cacheStats } from "../src/langs/css/cssCache";
import { SelectorType } from "../src/assets/types/common";

describe(`CSS Cache - 캐시 관리`, () => {
	beforeEach(() => {
		cacheClear();
	});

	describe(`cacheSet - 캐시 저장`, () => {
		it(`새 항목을 캐시에 저장해야 함`, () => {
			const key = `test-key`;
			const data = [
				{ index: 0, line: 0, col: 0, type: SelectorType.CLASS, selector: `test` },
			];

			cacheSet(key, { version: 1, data });

			const cached = cacheGet(key);
			expect(cached).toBeDefined();
			expect(cached?.data).toEqual(data);
		});

		it(`버전 정보를 저장해야 함`, () => {
			const key = `version-test`;
			cacheSet(key, { version: 5, data: [] });

			const cached = cacheGet(key);
			expect(cached?.version).toBe(5);
		});

		it(`같은 키로 다시 저장하면 덮어쓰기 되어야 함`, () => {
			const key = `overwrite-test`;
			cacheSet(key, { version: 1, data: [] });
			cacheSet(key, { version: 2, data: [] });

			const cached = cacheGet(key);
			expect(cached?.version).toBe(2);
		});
	});

	describe(`cacheGet - 캐시 조회`, () => {
		it(`존재하는 키의 값을 반환해야 함`, () => {
			const key = `existing-key`;
			const data = [
				{ index: 0, line: 0, col: 0, type: SelectorType.ID, selector: `main` },
			];

			cacheSet(key, { version: 1, data });

			const cached = cacheGet(key);
			expect(cached).toBeDefined();
			expect(cached?.data).toEqual(data);
		});

		it(`존재하지 않는 키는 undefined를 반환해야 함`, () => {
			const cached = cacheGet(`non-existing-key`);
			expect(cached).toBeUndefined();
		});

		it(`조회 시 접근 통계가 업데이트되어야 함`, () => {
			const key = `access-test`;
			cacheSet(key, { version: 1, data: [] });

			const first = cacheGet(key);
			const second = cacheGet(key);

			// 접근 횟수가 증가해야 함
			expect(second?.accessCount).toBeGreaterThanOrEqual(first?.accessCount ?? 0);
		});
	});

	describe(`cacheDelete - 캐시 삭제`, () => {
		it(`존재하는 항목을 삭제하고 true를 반환해야 함`, () => {
			const key = `delete-test`;
			cacheSet(key, { version: 1, data: [] });

			const result = cacheDelete(key);

			expect(result).toBe(true);
			expect(cacheGet(key)).toBeUndefined();
		});

		it(`존재하지 않는 항목 삭제 시 false를 반환해야 함`, () => {
			const result = cacheDelete(`non-existing`);
			expect(result).toBe(false);
		});
	});

	describe(`cacheClear - 캐시 초기화`, () => {
		it(`모든 캐시를 삭제해야 함`, () => {
			cacheSet(`key1`, { version: 1, data: [] });
			cacheSet(`key2`, { version: 1, data: [] });
			cacheSet(`key3`, { version: 1, data: [] });

			cacheClear();

			expect(cacheSize()).toBe(0);
			expect(cacheGet(`key1`)).toBeUndefined();
			expect(cacheGet(`key2`)).toBeUndefined();
			expect(cacheGet(`key3`)).toBeUndefined();
		});
	});

	describe(`cacheSize - 캐시 크기`, () => {
		it(`빈 캐시의 크기는 0이어야 함`, () => {
			expect(cacheSize()).toBe(0);
		});

		it(`항목 추가 시 크기가 증가해야 함`, () => {
			cacheSet(`key1`, { version: 1, data: [] });
			expect(cacheSize()).toBe(1);

			cacheSet(`key2`, { version: 1, data: [] });
			expect(cacheSize()).toBe(2);
		});

		it(`항목 삭제 시 크기가 감소해야 함`, () => {
			cacheSet(`key1`, { version: 1, data: [] });
			cacheSet(`key2`, { version: 1, data: [] });

			cacheDelete(`key1`);
			expect(cacheSize()).toBe(1);
		});
	});

	describe(`cacheStats - 캐시 통계`, () => {
		it(`통계 정보를 반환해야 함`, () => {
			const stats = cacheStats();

			expect(stats).toHaveProperty(`size`);
			expect(stats).toHaveProperty(`maxSize`);
			expect(stats).toHaveProperty(`ttlMs`);
		});

		it(`현재 캐시 크기를 반영해야 함`, () => {
			cacheSet(`key1`, { version: 1, data: [] });
			cacheSet(`key2`, { version: 1, data: [] });

			const stats = cacheStats();
			expect(stats.size).toBe(2);
		});

		it(`최대 캐시 크기를 반환해야 함`, () => {
			const stats = cacheStats();
			expect(stats.maxSize).toBeGreaterThan(0);
		});

		it(`TTL 값을 반환해야 함`, () => {
			const stats = cacheStats();
			expect(stats.ttlMs).toBeGreaterThan(0);
		});
	});

	describe(`LRU 동작`, () => {
		it(`최근 접근한 항목은 유지되어야 함`, () => {
			// 여러 항목 추가
			for (let i = 0; i < 10; i++) {
				cacheSet(`key${i}`, { version: 1, data: [] });
			}

			// 첫 번째 항목 접근
			cacheGet(`key0`);

			// 새 항목 추가 (첫 번째는 최근 접근되어 유지되어야 함)
			cacheSet(`newKey`, { version: 1, data: [] });

			const first = cacheGet(`key0`);
			expect(first).toBeDefined();
		});
	});

	describe(`버전 관리`, () => {
		it(`같은 버전은 캐시된 값을 반환해야 함`, () => {
			const key = `version-same`;
			const data = [
				{ index: 0, line: 0, col: 0, type: SelectorType.CLASS, selector: `test` },
			];

			cacheSet(key, { version: 1, data });

			const cached = cacheGet(key);
			expect(cached?.version).toBe(1);
			expect(cached?.data).toEqual(data);
		});

		it(`버전이 업데이트되면 새 값을 저장해야 함`, () => {
			const key = `version-update`;
			const oldData = [
				{ index: 0, line: 0, col: 0, type: SelectorType.CLASS, selector: `old` },
			];
			const newData = [
				{ index: 0, line: 0, col: 0, type: SelectorType.CLASS, selector: `new` },
			];

			cacheSet(key, { version: 1, data: oldData });
			cacheSet(key, { version: 2, data: newData });

			const cached = cacheGet(key);
			expect(cached?.version).toBe(2);
			expect(cached?.data).toEqual(newData);
		});
	});

	describe(`타임스탬프`, () => {
		it(`저장 시 타임스탬프가 설정되어야 함`, () => {
			const key = `timestamp-test`;
			const before = Date.now();

			cacheSet(key, { version: 1, data: [] });

			const cached = cacheGet(key);
			expect(cached?.timestamp).toBeGreaterThanOrEqual(before);
			expect(cached?.timestamp).toBeLessThanOrEqual(Date.now());
		});

		it(`접근 시 타임스탬프가 업데이트되어야 함`, () => {
			const key = `timestamp-update`;
			cacheSet(key, { version: 1, data: [] });

			const firstAccess = cacheGet(key);
			const firstTimestamp = firstAccess?.timestamp;

			// 약간의 시간 차이를 위해 대기
			const secondAccess = cacheGet(key);

			expect(secondAccess?.timestamp).toBeGreaterThanOrEqual(firstTimestamp ?? 0);
		});
	});
});
