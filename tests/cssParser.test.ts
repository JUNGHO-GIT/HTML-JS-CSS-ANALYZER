/**
 * @file cssParser.test.ts
 * @description CSS 선택자 파서 TDD 테스트
 */

import { parseSelectors } from "../src/langs/css/cssParser";
import { SelectorType } from "../src/assets/types/common";

describe(`parseSelectors - CSS 선택자 파싱`, () => {
	describe(`클래스 선택자 파싱`, () => {
		it(`단일 클래스 선택자를 파싱해야 함`, () => {
			const css = `.container { width: 100%; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0]).toMatchObject({
				type: SelectorType.CLASS,
				selector: `container`,
			});
		});

		it(`여러 클래스 선택자를 파싱해야 함`, () => {
			const css = `.header { color: red; } .footer { color: blue; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
			expect(selectors.map(s => s.selector)).toContain(`header`);
			expect(selectors.map(s => s.selector)).toContain(`footer`);
		});

		it(`쉼표로 구분된 선택자를 파싱해야 함`, () => {
			const css = `.header, .footer, .sidebar { margin: 0; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(3);
			expect(selectors.map(s => s.selector)).toEqual([ `header`, `footer`, `sidebar` ]);
		});

		it(`중첩된 클래스 선택자를 파싱해야 함`, () => {
			const css = `.parent .child { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
			expect(selectors.map(s => s.selector)).toContain(`parent`);
			expect(selectors.map(s => s.selector)).toContain(`child`);
		});

		it(`하이픈이 포함된 클래스 이름을 파싱해야 함`, () => {
			const css = `.my-class-name { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`my-class-name`);
		});

		it(`언더스코어가 포함된 클래스 이름을 파싱해야 함`, () => {
			const css = `.my_class_name { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`my_class_name`);
		});

		it(`숫자가 포함된 클래스 이름을 파싱해야 함`, () => {
			const css = `.item1 { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`item1`);
		});
	});

	describe(`ID 선택자 파싱`, () => {
		it(`단일 ID 선택자를 파싱해야 함`, () => {
			const css = `#main { width: 100%; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0]).toMatchObject({
				type: SelectorType.ID,
				selector: `main`,
			});
		});

		it(`여러 ID 선택자를 파싱해야 함`, () => {
			const css = `#header { color: red; } #footer { color: blue; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
			expect(selectors.every(s => s.type === SelectorType.ID)).toBe(true);
		});

		it(`하이픈이 포함된 ID를 파싱해야 함`, () => {
			const css = `#main-content { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`main-content`);
		});
	});

	describe(`혼합 선택자 파싱`, () => {
		it(`클래스와 ID가 혼합된 선택자를 파싱해야 함`, () => {
			const css = `#header .nav-item { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
			expect(selectors.find(s => s.type === SelectorType.ID)?.selector).toBe(`header`);
			expect(selectors.find(s => s.type === SelectorType.CLASS)?.selector).toBe(`nav-item`);
		});

		it(`요소와 클래스가 결합된 선택자를 파싱해야 함`, () => {
			const css = `div.container { width: 100%; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`container`);
		});

		it(`요소와 ID가 결합된 선택자를 파싱해야 함`, () => {
			const css = `div#main { width: 100%; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`main`);
		});
	});

	describe(`위치 정보`, () => {
		it(`선택자의 라인 번호를 올바르게 추적해야 함`, () => {
			const css = `.first {}\n.second {}`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
			expect(selectors[0].line).toBe(0);
			expect(selectors[1].line).toBe(1);
		});

		it(`선택자의 열 번호를 올바르게 추적해야 함`, () => {
			const css = `.first {}`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].col).toBe(0);
		});

		it(`선택자의 인덱스를 올바르게 추적해야 함`, () => {
			const css = `.first {}`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].index).toBe(0);
		});
	});

	describe(`주석 처리`, () => {
		it(`블록 주석이 규칙 내부에 있으면 무시해야 함`, () => {
			const css = `.container { /* color: red; */ width: 100%; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`container`);
		});

		it(`블록 주석 후 규칙이 정상 파싱되어야 함`, () => {
			const css = `/* comment */ .active { color: blue; }`;
			const selectors = parseSelectors(css);

			expect(selectors.length).toBeGreaterThanOrEqual(1);
			expect(selectors.some(s => s.selector === `active`)).toBe(true);
		});
	});

	describe(`문자열 처리`, () => {
		it(`작은따옴표 문자열 내의 선택자 문자를 무시해야 함`, () => {
			const css = `.btn::before { content: '.icon'; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`btn`);
		});

		it(`큰따옴표 문자열 내의 선택자 문자를 무시해야 함`, () => {
			const css = `.btn::before { content: ".icon"; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`btn`);
		});
	});

	describe(`@규칙 처리`, () => {
		it(`@media 규칙 내부의 선택자를 파싱해야 함`, () => {
			const css = `@media (max-width: 768px) { .mobile { display: block; } }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`mobile`);
		});

		it(`@keyframes 규칙은 선택자로 파싱하지 않아야 함`, () => {
			const css = `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(0);
		});
	});

	describe(`빈 입력 처리`, () => {
		it(`빈 문자열은 빈 배열을 반환해야 함`, () => {
			const selectors = parseSelectors(``);
			expect(selectors).toEqual([]);
		});

		it(`공백만 있는 문자열은 빈 배열을 반환해야 함`, () => {
			const selectors = parseSelectors(`   \n\t  `);
			expect(selectors).toEqual([]);
		});
	});

	describe(`복잡한 선택자`, () => {
		it(`자식 선택자(>)를 처리해야 함`, () => {
			const css = `.parent > .child { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
		});

		it(`인접 형제 선택자(+)를 처리해야 함`, () => {
			const css = `.first + .second { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
		});

		it(`일반 형제 선택자(~)를 처리해야 함`, () => {
			const css = `.first ~ .sibling { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(2);
		});

		it(`속성 선택자를 처리해야 함`, () => {
			const css = `.input[type="text"] { border: 1px solid; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`input`);
		});

		it(`의사 클래스 선택자를 처리해야 함`, () => {
			const css = `.btn:hover { color: red; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`btn`);
		});

		it(`의사 요소 선택자를 처리해야 함`, () => {
			const css = `.btn::before { content: ''; }`;
			const selectors = parseSelectors(css);

			expect(selectors).toHaveLength(1);
			expect(selectors[0].selector).toBe(`btn`);
		});
	});
});
