/**
 * @file htmlAnalyzer.ts
 * @since 2025-11-26
 * @description HTML 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const MAX_NESTING_LEVEL = 10;
const MAX_LINE_LENGTH = 200;
const MAX_ATTRIBUTES_PER_TAG = 15;

// REGEX PATTERNS
const HTML_TAG_REGEX = /<([a-zA-Z][a-zA-Z0-9-]*)\s*([^>]*)>/g;
const INLINE_STYLE_REGEX = /\bstyle\s*=\s*["'][^"']*["']/gi;
const INLINE_EVENT_REGEX = /\bon[a-z]+\s*=\s*["'][^"']*["']/gi;
const DEPRECATED_TAGS_REGEX = /<(center|font|marquee|blink|strike|big|tt|frameset|frame|noframes)\b/gi;
const DUPLICATE_ID_REGEX = /\bid\s*=\s*["']([^"']+)["']/gi;
const ATTRIBUTE_REGEX = /([a-zA-Z][a-zA-Z0-9-_]*)\s*(?:=\s*["'][^"']*["'])?/g;

// -------------------------------------------------------------------------------------------------
// TYPE DEFINITIONS
// -------------------------------------------------------------------------------------------------
declare type HtmlAnalysisIssue = {
	type: string;
	line: number;
	message: string;
	severity: `error` | `warning` | `info`;
};

declare type HtmlAnalysisResult = {
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

// -------------------------------------------------------------------------------------------------
// ANALYSIS FUNCTIONS
// -------------------------------------------------------------------------------------------------
const analyzeNesting = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
	const lines = sourceCode.split(`\n`);
	let currentNesting = 0;
	let maxNesting = 0;
	const selfClosingTags = new Set([
		`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`,
	]);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		const openTags = line.match(/<[a-zA-Z][a-zA-Z0-9-]*[^/>]*>/g) ?? [];
		const closeTags = line.match(/<\/[a-zA-Z][a-zA-Z0-9-]*>/g) ?? [];

		for (const tag of openTags) {
			const tagName = tag.match(/<([a-zA-Z][a-zA-Z0-9-]*)/)?.[1]?.toLowerCase();
			typeof tagName === `string` && tagName.length > 0 && !selfClosingTags.has(tagName) && !tag.endsWith(`/>`) && currentNesting++;
		}

		currentNesting > maxNesting && (maxNesting = currentNesting);

		currentNesting > MAX_NESTING_LEVEL && issues.push({
			type: `deep-nesting`,
			line: lineNum,
			message: `Excessive HTML nesting (${currentNesting} levels): consider refactoring`,
			severity: `warning`,
		});

		closeTags.forEach(() => {
			currentNesting > 0 && currentNesting--;
		});
	}

	return maxNesting;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineStyles = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
	const lines = sourceCode.split(`\n`);
	let inlineStyleCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const matches = line.match(INLINE_STYLE_REGEX);

		matches?.forEach(() => {
			inlineStyleCount++;
			issues.push({
				type: `inline-style`,
				line: lineNum,
				message: `Inline style detected: consider using external CSS`,
				severity: `info`,
			});
		});
	}

	return inlineStyleCount;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineEvents = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
	const lines = sourceCode.split(`\n`);
	let inlineEventCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const matches = line.match(INLINE_EVENT_REGEX);

		matches?.forEach(() => {
			inlineEventCount++;
			issues.push({
				type: `inline-event`,
				line: lineNum,
				message: `Inline event handler detected: consider using addEventListener`,
				severity: `info`,
			});
		});
	}

	return inlineEventCount;
};

// -------------------------------------------------------------------------------------------------
const analyzeDeprecatedTags = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		let match: RegExpExecArray | null;

		DEPRECATED_TAGS_REGEX.lastIndex = 0;
		while ((match = DEPRECATED_TAGS_REGEX.exec(line))) {
			issues.push({
				type: `deprecated-tag`,
				line: lineNum,
				message: `Deprecated tag <${match[1]}>: use modern alternatives`,
				severity: `warning`,
			});
		}
	}
};

// -------------------------------------------------------------------------------------------------
const analyzeDuplicateIds = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
	const idMap = new Map<string, number[]>();
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		let match: RegExpExecArray | null;

		DUPLICATE_ID_REGEX.lastIndex = 0;
		while ((match = DUPLICATE_ID_REGEX.exec(line))) {
			const id = match[1];
			const existing = idMap.get(id) ?? [];
			existing.push(lineNum);
			idMap.set(id, existing);
		}
	}

	idMap.forEach((lineNumbers, id) => {
		lineNumbers.length > 1 && issues.push({
			type: `duplicate-id`,
			line: lineNumbers[0],
			message: `Duplicate ID '${id}' found on lines: ${lineNumbers.join(`, `)}`,
			severity: `error`,
		});
	});
};

// -------------------------------------------------------------------------------------------------
const analyzeLineLength = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		line.length > MAX_LINE_LENGTH && issues.push({
			type: `long-line`,
			line: lineNum,
			message: `Long line (${line.length} chars): consider breaking for readability`,
			severity: `info`,
		});
	}
};

// -------------------------------------------------------------------------------------------------
const analyzeAttributeCount = (sourceCode: string, issues: HtmlAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		let tagMatch: RegExpExecArray | null;

		HTML_TAG_REGEX.lastIndex = 0;
		while ((tagMatch = HTML_TAG_REGEX.exec(line))) {
			const attributes = tagMatch[2];
			const attrCount = (attributes.match(ATTRIBUTE_REGEX) ?? []).length;

			attrCount > MAX_ATTRIBUTES_PER_TAG && issues.push({
				type: `too-many-attributes`,
				line: lineNum,
				message: `Tag has ${attrCount} attributes: consider using data attributes or simplifying`,
				severity: `warning`,
			});
		}
	}
};

// -------------------------------------------------------------------------------------------------
const analyzeDocumentStructure = (sourceCode: string): Pick<HtmlAnalysisResult, `hasDoctype` | `hasHtmlLang` | `hasMetaCharset` | `hasMetaViewport`> => {
	const hasDoctype = /<!DOCTYPE\s+html>/i.test(sourceCode);
	const hasHtmlLang = /<html[^>]*\slang\s*=/i.test(sourceCode);
	const hasMetaCharset = /<meta[^>]*charset\s*=/i.test(sourceCode);
	const hasMetaViewport = /<meta[^>]*name\s*=\s*["']viewport["']/i.test(sourceCode);

	return { hasDoctype, hasHtmlLang, hasMetaCharset, hasMetaViewport };
};

// -------------------------------------------------------------------------------------------------
const countTags = (sourceCode: string): number => {
	const matches = sourceCode.match(/<[a-zA-Z][a-zA-Z0-9-]*[^>]*>/g);
	return matches ? matches.length : 0;
};

// -------------------------------------------------------------------------------------------------
// MAIN ANALYSIS FUNCTION
// -------------------------------------------------------------------------------------------------
export const analyzeHtmlCode = (sourceCode: string): HtmlAnalysisResult => {
	const issues: HtmlAnalysisIssue[] = [];

	const maxNestingLevel = analyzeNesting(sourceCode, issues);
	const inlineStyleCount = analyzeInlineStyles(sourceCode, issues);
	const inlineEventCount = analyzeInlineEvents(sourceCode, issues);
	analyzeDeprecatedTags(sourceCode, issues);
	analyzeDuplicateIds(sourceCode, issues);
	analyzeLineLength(sourceCode, issues);
	analyzeAttributeCount(sourceCode, issues);

	const structure = analyzeDocumentStructure(sourceCode);
	const tagCount = countTags(sourceCode);

	return {
		issues,
		tagCount,
		maxNestingLevel,
		inlineStyleCount,
		inlineEventCount,
		...structure,
	};
};

// -------------------------------------------------------------------------------------------------
// DIAGNOSTIC GENERATION
// -------------------------------------------------------------------------------------------------
export const generateHtmlAnalysisDiagnostics = (document: vscode.TextDocument, analysis: HtmlAnalysisResult): vscode.Diagnostic[] => {
	const diagnostics: vscode.Diagnostic[] = [];

	analysis.issues.forEach((issue) => {
		const line = Math.max(issue.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(
			new vscode.Position(line, 0),
			new vscode.Position(line, lineText.length)
		);

		const severity = issue.severity === `error` ? (
			vscode.DiagnosticSeverity.Error
		) : issue.severity === `warning` ? (
			vscode.DiagnosticSeverity.Warning
		) : (
			vscode.DiagnosticSeverity.Information
		);

		const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
		diagnostic.source = `HTML-Analyzer`;
		diagnostic.code = issue.type;
		(diagnostic as vscode.Diagnostic & { data: unknown }).data = {
			ruleId: issue.type,
			line: issue.line,
			analysisType: `html-quality`,
		};

		diagnostics.push(diagnostic);
	});

	return diagnostics;
};

// -------------------------------------------------------------------------------------------------
// EXPORT TYPES
// -------------------------------------------------------------------------------------------------
export type { HtmlAnalysisIssue, HtmlAnalysisResult };
