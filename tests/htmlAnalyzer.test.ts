/**
 * @file htmlAnalyzer.test.ts
 * @description HTML 코드 분석기 TDD 테스트
 */

// HTML 분석 모듈
namespace HtmlAnalyzerTest {
	const HTML_MAX_NESTING_LEVEL = 10;
	const HTML_MAX_LINE_LENGTH = 200;

	const INLINE_STYLE_REGEX = /\bstyle\s*=\s*["'][^"']*["']/gi;
	const INLINE_EVENT_REGEX = /\bon[a-z]+\s*=\s*["'][^"']*["']/gi;
	const DEPRECATED_TAGS_REGEX = /<(center|font|marquee|blink|strike|big|tt|frameset|frame|noframes)\b/gi;
	const DUPLICATE_ID_REGEX = /\bid\s*=\s*["']([^"']+)["']/gi;
	const IMG_WITHOUT_ALT_REGEX = /<img\b(?![^>]*\balt\s*=)[^>]*>/gi;
	const A_WITHOUT_HREF_REGEX = /<a\b(?![^>]*\bhref\s*=)[^>]*>/gi;
	const BUTTON_WITHOUT_TYPE_REGEX = /<button\b(?![^>]*\btype\s*=)[^>]*>/gi;
	const TARGET_BLANK_REGEX = /target\s*=\s*["']_blank["'](?![^>]*\brel\s*=\s*["'](?:[^"']*\s)?noopener(?:[^"']*)?["'])/gi;

	type HtmlAnalysisIssue = { type: string; line: number; message: string; severity: `error` | `warning` | `info`; };
	type HtmlAnalysisResult = {
		issues: HtmlAnalysisIssue[];
		tagCount: number;
		maxNestingLevel: number;
		hasDoctype: boolean;
		hasHtmlLang: boolean;
		hasMetaCharset: boolean;
		hasMetaViewport: boolean;
		inlineStyleCount: number;
		inlineEventCount: number;
	};

	const analyzeNesting = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
		const lines = sourceCode.split(`\n`);
		let currentNesting = 0, maxNesting = 0;
		const selfClosingTags = new Set([`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`]);
		for (let i = 0; i < lines.length; i++) {
			const openTags = lines[i].match(/<[a-zA-Z][a-zA-Z0-9-]*[^/>]*>/g) ?? [];
			const closeTags = lines[i].match(/<\/[a-zA-Z][a-zA-Z0-9-]*>/g) ?? [];
			for (const tag of openTags) {
				const tagName = tag.match(/<([a-zA-Z][a-zA-Z0-9-]*)/)?.[1]?.toLowerCase();
				if (tagName && !selfClosingTags.has(tagName) && !tag.endsWith(`/>`)) currentNesting++;
			}
			if (currentNesting > maxNesting) maxNesting = currentNesting;
			if (currentNesting > HTML_MAX_NESTING_LEVEL) issues.push({ type: `deep-nesting`, line: i + 1, message: `Excessive nesting`, severity: `warning` });
			closeTags.forEach(() => { if (currentNesting > 0) currentNesting--; });
		}
		return maxNesting;
	};

	const analyzeInlineStyles = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
		let count = 0;
		sourceCode.split(`\n`).forEach((line, i) => {
			const matches = line.match(INLINE_STYLE_REGEX);
			if (matches) { count += matches.length; issues.push({ type: `inline-style`, line: i + 1, message: `Inline style`, severity: `info` }); }
		});
		return count;
	};

	const analyzeInlineEvents = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
		let count = 0;
		sourceCode.split(`\n`).forEach((line, i) => {
			const matches = line.match(INLINE_EVENT_REGEX);
			if (matches) { count += matches.length; issues.push({ type: `inline-event`, line: i + 1, message: `Inline event`, severity: `info` }); }
		});
		return count;
	};

	const analyzeDeprecatedTags = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
		sourceCode.split(`\n`).forEach((line, i) => {
			DEPRECATED_TAGS_REGEX.lastIndex = 0;
			let match;
			while ((match = DEPRECATED_TAGS_REGEX.exec(line))) issues.push({ type: `deprecated-tag`, line: i + 1, message: `Deprecated tag <${match[1]}>`, severity: `warning` });
		});
	};

	const analyzeDuplicateIds = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
		const idMap = new Map<string, number[]>();
		sourceCode.split(`\n`).forEach((line, i) => {
			DUPLICATE_ID_REGEX.lastIndex = 0;
			let match;
			while ((match = DUPLICATE_ID_REGEX.exec(line))) {
				const existing = idMap.get(match[1]) ?? [];
				existing.push(i + 1);
				idMap.set(match[1], existing);
			}
		});
		idMap.forEach((lineNumbers, id) => {
			if (lineNumbers.length > 1) issues.push({ type: `duplicate-id`, line: lineNumbers[0], message: `Duplicate ID '${id}'`, severity: `error` });
		});
	};

	const analyzeLineLength = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
		sourceCode.split(`\n`).forEach((line, i) => {
			if (line.length > HTML_MAX_LINE_LENGTH) issues.push({ type: `long-line`, line: i + 1, message: `Long line (${line.length} chars)`, severity: `info` });
		});
	};

	const analyzeAccessibility = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
		sourceCode.split(`\n`).forEach((line, i) => {
			IMG_WITHOUT_ALT_REGEX.lastIndex = 0; A_WITHOUT_HREF_REGEX.lastIndex = 0; BUTTON_WITHOUT_TYPE_REGEX.lastIndex = 0;
			if (IMG_WITHOUT_ALT_REGEX.test(line)) issues.push({ type: `a11y-img-alt`, line: i + 1, message: `Missing alt`, severity: `warning` });
			if (A_WITHOUT_HREF_REGEX.test(line)) issues.push({ type: `a11y-anchor-href`, line: i + 1, message: `Missing href`, severity: `warning` });
			if (BUTTON_WITHOUT_TYPE_REGEX.test(line)) issues.push({ type: `best-practice-button-type`, line: i + 1, message: `Missing type`, severity: `info` });
		});
	};

	const analyzeHtmlSecurity = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
		sourceCode.split(`\n`).forEach((line, i) => {
			TARGET_BLANK_REGEX.lastIndex = 0;
			if (TARGET_BLANK_REGEX.test(line)) issues.push({ type: `security-target-blank`, line: i + 1, message: `target=_blank risk`, severity: `warning` });
		});
	};

	export const analyzeHtmlCode = (sourceCode: string): HtmlAnalysisResult => {
		const issues: HtmlAnalysisIssue[] = [];
		const maxNestingLevel = analyzeNesting(sourceCode, issues);
		const inlineStyleCount = analyzeInlineStyles(sourceCode, issues);
		const inlineEventCount = analyzeInlineEvents(sourceCode, issues);
		analyzeDeprecatedTags(sourceCode, issues);
		analyzeDuplicateIds(sourceCode, issues);
		analyzeLineLength(sourceCode, issues);
		analyzeAccessibility(sourceCode, issues);
		analyzeHtmlSecurity(sourceCode, issues);
		return {
			issues,
			tagCount: (sourceCode.match(/<[a-zA-Z][a-zA-Z0-9-]*[^>]*>/g) || []).length,
			maxNestingLevel,
			hasDoctype: /<!DOCTYPE\s+html>/i.test(sourceCode),
			hasHtmlLang: /<html[^>]*\slang\s*=/i.test(sourceCode),
			hasMetaCharset: /<meta[^>]*charset\s*=/i.test(sourceCode),
			hasMetaViewport: /<meta[^>]*name\s*=\s*["']viewport["']/i.test(sourceCode),
			inlineStyleCount,
			inlineEventCount,
		};
	};
}

const analyzeHtmlCode = HtmlAnalyzerTest.analyzeHtmlCode;

describe(`analyzeHtmlCode - HTML 코드 분석`, () => {
	describe(`인라인 스타일 검사`, () => {
		it(`인라인 스타일을 감지해야 함`, () => {
			const html = `<div style="color: red;">Content</div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `inline-style`).length).toBeGreaterThan(0);
			expect(result.inlineStyleCount).toBeGreaterThan(0);
		});

		it(`여러 인라인 스타일을 모두 감지해야 함`, () => {
			const html = `<div style="color: red;">First</div>\n<span style="margin: 10px;">Second</span>`;
			const result = analyzeHtmlCode(html);
			expect(result.inlineStyleCount).toBeGreaterThanOrEqual(2);
		});

		it(`인라인 스타일이 없는 경우 경고하지 않아야 함`, () => {
			const html = `<div class="styled">Content</div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `inline-style`)).toHaveLength(0);
		});
	});

	describe(`인라인 이벤트 핸들러 검사`, () => {
		it(`인라인 이벤트 핸들러를 감지해야 함`, () => {
			const html = `<button onclick="handleClick()">Click</button>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `inline-event`).length).toBeGreaterThan(0);
		});

		it(`다양한 이벤트 핸들러를 감지해야 함`, () => {
			const html = `<input onchange="update()" />\n<form onsubmit="submit()"></form>\n<div onmouseover="hover()"></div>`;
			const result = analyzeHtmlCode(html);
			expect(result.inlineEventCount).toBeGreaterThanOrEqual(3);
		});
	});

	describe(`deprecated 태그 검사`, () => {
		it(`center 태그를 감지해야 함`, () => {
			const result = analyzeHtmlCode(`<center>Centered text</center>`);
			expect(result.issues.filter(i => i.type === `deprecated-tag`).length).toBeGreaterThan(0);
		});

		it(`font 태그를 감지해야 함`, () => {
			const result = analyzeHtmlCode(`<font color="red">Red text</font>`);
			expect(result.issues.filter(i => i.type === `deprecated-tag`).length).toBeGreaterThan(0);
		});

		it(`현대적인 태그는 경고하지 않아야 함`, () => {
			const result = analyzeHtmlCode(`<div><span>Modern HTML</span></div>`);
			expect(result.issues.filter(i => i.type === `deprecated-tag`)).toHaveLength(0);
		});
	});

	describe(`중복 ID 검사`, () => {
		it(`중복된 ID를 감지해야 함`, () => {
			const html = `<div id="main">First</div>\n<div id="main">Second</div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `duplicate-id`).length).toBeGreaterThan(0);
		});

		it(`고유한 ID는 경고하지 않아야 함`, () => {
			const html = `<div id="header">Header</div>\n<div id="footer">Footer</div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `duplicate-id`)).toHaveLength(0);
		});
	});

	describe(`깊은 중첩 검사`, () => {
		it(`과도한 중첩을 감지해야 함`, () => {
			const html = `<div><div><div><div><div><div><div><div><div><div><div>Deep</div></div></div></div></div></div></div></div></div></div></div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `deep-nesting`).length).toBeGreaterThan(0);
			expect(result.maxNestingLevel).toBeGreaterThan(10);
		});

		it(`적절한 중첩은 경고하지 않아야 함`, () => {
			const html = `<div><header><nav>Menu</nav></header></div>`;
			const result = analyzeHtmlCode(html);
			expect(result.issues.filter(i => i.type === `deep-nesting`)).toHaveLength(0);
		});
	});

	describe(`긴 라인 검사`, () => {
		it(`긴 라인을 감지해야 함`, () => {
			const longLine = `<div class="${`very-long-class-name `.repeat(20)}">Content</div>`;
			const result = analyzeHtmlCode(longLine);
			expect(result.issues.filter(i => i.type === `long-line`).length).toBeGreaterThan(0);
		});
	});

	describe(`접근성 검사`, () => {
		it(`alt 속성 없는 img 태그를 감지해야 함`, () => {
			const result = analyzeHtmlCode(`<img src="image.jpg">`);
			expect(result.issues.filter(i => i.type === `a11y-img-alt`).length).toBeGreaterThan(0);
		});

		it(`alt 속성이 있는 img 태그는 경고하지 않아야 함`, () => {
			const result = analyzeHtmlCode(`<img src="image.jpg" alt="Description">`);
			expect(result.issues.filter(i => i.type === `a11y-img-alt`)).toHaveLength(0);
		});

		it(`href 속성 없는 a 태그를 감지해야 함`, () => {
			const result = analyzeHtmlCode(`<a>Link text</a>`);
			expect(result.issues.filter(i => i.type === `a11y-anchor-href`).length).toBeGreaterThan(0);
		});
	});

	describe(`보안 검사`, () => {
		it(`rel=noopener 없는 target=_blank를 감지해야 함`, () => {
			const result = analyzeHtmlCode(`<a href="https://example.com" target="_blank">Link</a>`);
			expect(result.issues.filter(i => i.type === `security-target-blank`).length).toBeGreaterThan(0);
		});

		it(`rel=noopener가 있는 target=_blank는 경고하지 않아야 함`, () => {
			const result = analyzeHtmlCode(`<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>`);
			expect(result.issues.filter(i => i.type === `security-target-blank`)).toHaveLength(0);
		});
	});

	describe(`문서 구조 분석`, () => {
		it(`DOCTYPE 존재 여부를 감지해야 함`, () => {
			expect(analyzeHtmlCode(`<!DOCTYPE html><html></html>`).hasDoctype).toBe(true);
			expect(analyzeHtmlCode(`<html></html>`).hasDoctype).toBe(false);
		});

		it(`html lang 속성 존재 여부를 감지해야 함`, () => {
			expect(analyzeHtmlCode(`<html lang="ko"></html>`).hasHtmlLang).toBe(true);
			expect(analyzeHtmlCode(`<html></html>`).hasHtmlLang).toBe(false);
		});

		it(`meta charset 존재 여부를 감지해야 함`, () => {
			expect(analyzeHtmlCode(`<head><meta charset="utf-8"></head>`).hasMetaCharset).toBe(true);
			expect(analyzeHtmlCode(`<head><title>Test</title></head>`).hasMetaCharset).toBe(false);
		});

		it(`meta viewport 존재 여부를 감지해야 함`, () => {
			expect(analyzeHtmlCode(`<head><meta name="viewport" content="width=device-width"></head>`).hasMetaViewport).toBe(true);
			expect(analyzeHtmlCode(`<head><title>Test</title></head>`).hasMetaViewport).toBe(false);
		});
	});

	describe(`태그 수 계산`, () => {
		it(`태그 수를 정확히 계산해야 함`, () => {
			const result = analyzeHtmlCode(`<div><span>Text</span><p>Paragraph</p></div>`);
			expect(result.tagCount).toBeGreaterThanOrEqual(3);
		});

		it(`빈 HTML은 태그 수가 0이어야 함`, () => {
			expect(analyzeHtmlCode(``).tagCount).toBe(0);
		});
	});

	describe(`이슈 심각도`, () => {
		it(`deprecated 태그는 warning 심각도여야 함`, () => {
			const result = analyzeHtmlCode(`<center>Text</center>`);
			const issue = result.issues.find(i => i.type === `deprecated-tag`);
			expect(issue?.severity).toBe(`warning`);
		});

		it(`인라인 스타일은 info 심각도여야 함`, () => {
			const result = analyzeHtmlCode(`<div style="color: red;">Text</div>`);
			const issue = result.issues.find(i => i.type === `inline-style`);
			expect(issue?.severity).toBe(`info`);
		});

		it(`중복 ID는 error 심각도여야 함`, () => {
			const result = analyzeHtmlCode(`<div id="dup"></div>\n<div id="dup"></div>`);
			const issue = result.issues.find(i => i.type === `duplicate-id`);
			expect(issue?.severity).toBe(`error`);
		});
	});

	describe(`빈 입력 처리`, () => {
		it(`빈 HTML은 기본 결과를 반환해야 함`, () => {
			const result = analyzeHtmlCode(``);
			expect(result.issues).toHaveLength(0);
			expect(result.tagCount).toBe(0);
			expect(result.maxNestingLevel).toBe(0);
		});
	});
});
