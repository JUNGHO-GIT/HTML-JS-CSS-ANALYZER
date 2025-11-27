/**
 * @file cssAnalyzer.test.ts
 * @description CSS 코드 분석기 TDD 테스트
 */

// 독립적인 CSS 분석 함수 (vscode 의존성 없음)
const EMPTY_RULE_REGEX = /([^{]+)\{\s*\}/g;
const IMPORTANT_REGEX = /!important/g;
const UNIVERSAL_SELECTOR_REGEX = /(^|[\s>+~])\*(?![a-zA-Z0-9-_])/g;
const ID_SELECTOR_REGEX = /#[a-zA-Z0-9-_]+/g;
const MAX_ID_SELECTORS = 2;

type CssAnalysisIssue = {
	type: string;
	line: number;
	message: string;
	severity: `error` | `warning` | `info`;
};

type CssAnalysisResult = {
	issues: CssAnalysisIssue[];
};

const analyzeEmptyRules = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		if (EMPTY_RULE_REGEX.test(line)) {
			issues.push({
				type: `empty-rule`,
				line: lineNum,
				message: `Empty CSS rule detected`,
				severity: `warning`,
			});
		}
		EMPTY_RULE_REGEX.lastIndex = 0;
	}
};

const analyzeImportant = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		IMPORTANT_REGEX.lastIndex = 0;
		if (IMPORTANT_REGEX.test(line)) {
			issues.push({
				type: `important-usage`,
				line: lineNum,
				message: `Avoid using !important; it breaks cascading`,
				severity: `info`,
			});
		}
	}
};

const analyzePerformance = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		if (UNIVERSAL_SELECTOR_REGEX.test(line)) {
			issues.push({
				type: `universal-selector`,
				line: lineNum,
				message: `Universal selector (*) can be slow`,
				severity: `info`,
			});
		}
		UNIVERSAL_SELECTOR_REGEX.lastIndex = 0;

		const idCount = (line.match(ID_SELECTOR_REGEX) || []).length;
		if (idCount > MAX_ID_SELECTORS) {
			issues.push({
				type: `too-many-ids`,
				line: lineNum,
				message: `High specificity: ${idCount} ID selectors in one rule`,
				severity: `warning`,
			});
		}
	}
};

const analyzeCssCode = (sourceCode: string): CssAnalysisResult => {
	const issues: CssAnalysisIssue[] = [];
	analyzeEmptyRules(sourceCode, issues);
	analyzeImportant(sourceCode, issues);
	analyzePerformance(sourceCode, issues);
	return { issues };
};

describe(`analyzeCssCode - CSS 코드 분석`, () => {
	describe(`빈 규칙 검사`, () => {
		it(`빈 CSS 규칙을 감지해야 함`, () => {
			const css = `.empty {}`;
			const result = analyzeCssCode(css);

			const emptyRuleIssues = result.issues.filter(i => i.type === `empty-rule`);
			expect(emptyRuleIssues.length).toBeGreaterThan(0);
		});

		it(`내용이 있는 규칙은 경고하지 않아야 함`, () => {
			const css = `.valid { color: red; }`;
			const result = analyzeCssCode(css);

			const emptyRuleIssues = result.issues.filter(i => i.type === `empty-rule`);
			expect(emptyRuleIssues).toHaveLength(0);
		});

		it(`여러 빈 규칙을 모두 감지해야 함`, () => {
			const css = `.first {}\n.second {}\n.third { color: red; }`;
			const result = analyzeCssCode(css);

			const emptyRuleIssues = result.issues.filter(i => i.type === `empty-rule`);
			expect(emptyRuleIssues.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe(`!important 사용 검사`, () => {
		it(`!important 사용을 감지해야 함`, () => {
			const css = `.override { color: red !important; }`;
			const result = analyzeCssCode(css);

			const importantIssues = result.issues.filter(i => i.type === `important-usage`);
			expect(importantIssues.length).toBeGreaterThan(0);
		});

		it(`여러 라인에 !important가 있으면 각각 감지해야 함`, () => {
			const css = `.first { color: red !important; }\n.second { margin: 0 !important; }`;
			const result = analyzeCssCode(css);

			const importantIssues = result.issues.filter(i => i.type === `important-usage`);
			expect(importantIssues.length).toBe(2);
		});

		it(`!important가 없는 코드는 경고하지 않아야 함`, () => {
			const css = `.normal { color: red; margin: 10px; }`;
			const result = analyzeCssCode(css);

			const importantIssues = result.issues.filter(i => i.type === `important-usage`);
			expect(importantIssues).toHaveLength(0);
		});
	});

	describe(`유니버설 선택자 검사`, () => {
		it(`유니버설 선택자 사용을 감지해야 함`, () => {
			const css = `* { margin: 0; }`;
			const result = analyzeCssCode(css);

			const universalIssues = result.issues.filter(i => i.type === `universal-selector`);
			expect(universalIssues.length).toBeGreaterThan(0);
		});

		it(`자손 선택자에서 유니버설 선택자를 감지해야 함`, () => {
			const css = `.container * { color: red; }`;
			const result = analyzeCssCode(css);

			const universalIssues = result.issues.filter(i => i.type === `universal-selector`);
			expect(universalIssues.length).toBeGreaterThan(0);
		});

		it(`일반 클래스 선택자는 경고하지 않아야 함`, () => {
			const css = `.container { color: red; }`;
			const result = analyzeCssCode(css);

			const universalIssues = result.issues.filter(i => i.type === `universal-selector`);
			expect(universalIssues).toHaveLength(0);
		});
	});

	describe(`ID 선택자 과다 사용 검사`, () => {
		it(`한 규칙에 너무 많은 ID 선택자 사용을 감지해야 함`, () => {
			const css = `#header #nav #item { color: red; }`;
			const result = analyzeCssCode(css);

			const idIssues = result.issues.filter(i => i.type === `too-many-ids`);
			expect(idIssues.length).toBeGreaterThan(0);
		});

		it(`적절한 ID 선택자 수는 경고하지 않아야 함`, () => {
			const css = `#main { color: red; }`;
			const result = analyzeCssCode(css);

			const idIssues = result.issues.filter(i => i.type === `too-many-ids`);
			expect(idIssues).toHaveLength(0);
		});

		it(`두 개의 ID 선택자는 경고하지 않아야 함`, () => {
			const css = `#parent #child { color: red; }`;
			const result = analyzeCssCode(css);

			const idIssues = result.issues.filter(i => i.type === `too-many-ids`);
			expect(idIssues).toHaveLength(0);
		});
	});

	describe(`이슈 심각도`, () => {
		it(`빈 규칙 이슈는 warning 심각도여야 함`, () => {
			const css = `.empty {}`;
			const result = analyzeCssCode(css);

			const emptyRuleIssue = result.issues.find(i => i.type === `empty-rule`);
			expect(emptyRuleIssue?.severity).toBe(`warning`);
		});

		it(`!important 이슈는 info 심각도여야 함`, () => {
			const css = `.override { color: red !important; }`;
			const result = analyzeCssCode(css);

			const importantIssue = result.issues.find(i => i.type === `important-usage`);
			expect(importantIssue?.severity).toBe(`info`);
		});

		it(`유니버설 선택자 이슈는 info 심각도여야 함`, () => {
			const css = `* { margin: 0; }`;
			const result = analyzeCssCode(css);

			const universalIssue = result.issues.find(i => i.type === `universal-selector`);
			expect(universalIssue?.severity).toBe(`info`);
		});

		it(`ID 과다 사용 이슈는 warning 심각도여야 함`, () => {
			const css = `#a #b #c { color: red; }`;
			const result = analyzeCssCode(css);

			const idIssue = result.issues.find(i => i.type === `too-many-ids`);
			expect(idIssue?.severity).toBe(`warning`);
		});
	});

	describe(`라인 번호 정확성`, () => {
		it(`이슈의 라인 번호가 정확해야 함`, () => {
			const css = `.valid { color: red; }\n.empty {}`;
			const result = analyzeCssCode(css);

			const emptyRuleIssue = result.issues.find(i => i.type === `empty-rule`);
			expect(emptyRuleIssue?.line).toBe(2);
		});

		it(`첫 번째 라인의 이슈는 라인 1이어야 함`, () => {
			const css = `* { margin: 0; }`;
			const result = analyzeCssCode(css);

			const universalIssue = result.issues.find(i => i.type === `universal-selector`);
			expect(universalIssue?.line).toBe(1);
		});
	});

	describe(`이슈 메시지`, () => {
		it(`빈 규칙 이슈는 적절한 메시지를 가져야 함`, () => {
			const css = `.empty {}`;
			const result = analyzeCssCode(css);

			const emptyRuleIssue = result.issues.find(i => i.type === `empty-rule`);
			expect(emptyRuleIssue?.message).toContain(`Empty`);
		});

		it(`!important 이슈는 적절한 메시지를 가져야 함`, () => {
			const css = `.override { color: red !important; }`;
			const result = analyzeCssCode(css);

			const importantIssue = result.issues.find(i => i.type === `important-usage`);
			expect(importantIssue?.message).toContain(`!important`);
		});
	});

	describe(`빈 입력 처리`, () => {
		it(`빈 CSS는 이슈 없이 반환해야 함`, () => {
			const result = analyzeCssCode(``);
			expect(result.issues).toHaveLength(0);
		});

		it(`공백만 있는 CSS는 이슈 없이 반환해야 함`, () => {
			const result = analyzeCssCode(`   \n\t  `);
			expect(result.issues).toHaveLength(0);
		});
	});

	describe(`복합 분석`, () => {
		it(`여러 종류의 이슈를 동시에 감지해야 함`, () => {
			const css = `
				* { margin: 0; }
				.empty {}
				.important { color: red !important; }
				#a #b #c { padding: 0; }
			`;
			const result = analyzeCssCode(css);

			const issueTypes = new Set(result.issues.map(i => i.type));
			expect(issueTypes.has(`universal-selector`)).toBe(true);
			expect(issueTypes.has(`empty-rule`)).toBe(true);
			expect(issueTypes.has(`important-usage`)).toBe(true);
			expect(issueTypes.has(`too-many-ids`)).toBe(true);
		});
	});
});
