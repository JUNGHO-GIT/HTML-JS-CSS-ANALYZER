/**
 * @file lineIndex.test.ts
 * @description LineIndexMapper 모듈 TDD 테스트
 */

import { LineIndexMapper, type LineIndex } from "../src/assets/scripts/lineIndex";

describe(`LineIndexMapper`, () => {
	describe(`fromIndex - 인덱스에서 줄/열 위치 변환`, () => {
		it(`빈 문자열에서 인덱스 0은 null을 반환해야 함`, () => {
			const mapper = LineIndexMapper(``) as LineIndex;
			expect(mapper.fromIndex(0)).toBeNull();
		});

		it(`단일 라인 문자열에서 첫 번째 문자 위치를 찾아야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const pos = mapper.fromIndex(0);
			expect(pos).toEqual({ line: 0, col: 0 });
		});

		it(`단일 라인 문자열에서 마지막 문자 위치를 찾아야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const pos = mapper.fromIndex(4);
			expect(pos).toEqual({ line: 0, col: 4 });
		});

		it(`여러 라인 문자열에서 두 번째 줄의 위치를 찾아야 함`, () => {
			const mapper = LineIndexMapper(`hello\nworld`) as LineIndex;
			// `hello\n` = 6 characters, `w` is at index 6
			const pos = mapper.fromIndex(6);
			expect(pos).toEqual({ line: 1, col: 0 });
		});

		it(`여러 라인 문자열에서 세 번째 줄의 중간 위치를 찾아야 함`, () => {
			const mapper = LineIndexMapper(`line1\nline2\nline3`) as LineIndex;
			// `line1\n` = 6, `line2\n` = 6, `line3` starts at 12
			// `line3` 의 index 3 위치 (l-i-n-e) -> col 3
			const pos = mapper.fromIndex(15); // 12 + 3
			expect(pos).toEqual({ line: 2, col: 3 });
		});

		it(`음수 인덱스는 null을 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const pos = mapper.fromIndex(-1);
			expect(pos).toBeNull();
		});

		it(`범위를 벗어난 인덱스는 null을 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const pos = mapper.fromIndex(10);
			expect(pos).toBeNull();
		});

		it(`origin 옵션을 사용하여 1-based 인덱싱을 지원해야 함`, () => {
			const mapper = LineIndexMapper(`hello\nworld`, { origin: 1 }) as LineIndex;
			const pos = mapper.fromIndex(0);
			expect(pos).toEqual({ line: 1, col: 1 });
		});
	});

	describe(`toIndex - 줄/열 위치에서 인덱스 변환`, () => {
		it(`단일 라인 문자열에서 첫 번째 위치의 인덱스를 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const idx = mapper.toIndex(0, 0);
			expect(idx).toBe(0);
		});

		it(`단일 라인 문자열에서 중간 위치의 인덱스를 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const idx = mapper.toIndex(0, 3);
			expect(idx).toBe(3);
		});

		it(`여러 라인 문자열에서 두 번째 줄의 시작 인덱스를 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello\nworld`) as LineIndex;
			const idx = mapper.toIndex(1, 0);
			expect(idx).toBe(6);
		});

		it(`유효하지 않은 라인은 -1을 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const idx = mapper.toIndex(5, 0);
			expect(idx).toBe(-1);
		});

		it(`유효하지 않은 열은 -1을 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const idx = mapper.toIndex(0, 10);
			expect(idx).toBe(-1);
		});

		it(`NaN 값은 -1을 반환해야 함`, () => {
			const mapper = LineIndexMapper(`hello`) as LineIndex;
			const idx = mapper.toIndex(NaN, 0);
			expect(idx).toBe(-1);
		});
	});

	describe(`숏핸드 호출`, () => {
		it(`두 번째 인자로 숫자를 전달하면 fromIndex 결과를 직접 반환해야 함`, () => {
			const pos = LineIndexMapper(`hello`, 2);
			expect(pos).toEqual({ line: 0, col: 2 });
		});

		it(`유효하지 않은 인덱스는 null을 반환해야 함`, () => {
			const pos = LineIndexMapper(`hello`, -1);
			expect(pos).toBeNull();
		});
	});

	describe(`엣지 케이스`, () => {
		it(`빈 라인이 포함된 문자열을 처리해야 함`, () => {
			const mapper = LineIndexMapper(`line1\n\nline3`) as LineIndex;
			// `line1\n` = 6, `\n` = 1, `line3` starts at 7
			const pos = mapper.fromIndex(7);
			expect(pos).toEqual({ line: 2, col: 0 });
		});

		it(`마지막 줄에 개행이 없는 경우 처리해야 함`, () => {
			const mapper = LineIndexMapper(`hello\nworld`) as LineIndex;
			const pos = mapper.fromIndex(10);
			expect(pos).toEqual({ line: 1, col: 4 });
		});

		it(`단일 문자 문자열을 처리해야 함`, () => {
			const mapper = LineIndexMapper(`x`) as LineIndex;
			const pos = mapper.fromIndex(0);
			expect(pos).toEqual({ line: 0, col: 0 });
		});

		it(`개행만 있는 문자열을 처리해야 함`, () => {
			const mapper = LineIndexMapper(`\n\n\n`) as LineIndex;
			const pos = mapper.fromIndex(1);
			expect(pos).toEqual({ line: 1, col: 0 });
		});

		it(`유니코드 문자가 포함된 문자열을 처리해야 함`, () => {
			const mapper = LineIndexMapper(`한글\n테스트`) as LineIndex;
			// `한글\n` = 3 characters
			const pos = mapper.fromIndex(3);
			expect(pos).toEqual({ line: 1, col: 0 });
		});
	});
});
