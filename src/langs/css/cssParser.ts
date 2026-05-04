/**
 * @file cssParser.ts
 * @since 2025-11-22
 * @description CSS AST 기반 선택자 파서 (css-tree 라이브러리 사용)
 */

import { type SelectorPos, SelectorType } from "@exportTypes";
import * as csstree from "css-tree";

// TYPES ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export type ParsedSelector = SelectorPos & {
  specificity?: [number, number, number];
  parentRule?: string;
};

export type ParseOptions = {
  includeSpecificity?: boolean;
  includeParentRule?: boolean;
  filterByType?: SelectorType;
};

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const DEFAULT_PARSE_OPTIONS: csstree.ParseOptions = {
  positions: true,
  parseAtrulePrelude: false,
  parseRulePrelude: true,
  parseValue: false,
};

// HELPERS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
const calculateSpecificity = (selector: csstree.CssNode): [number, number, number] => {
  let ids = 0;
  let classes = 0;
  let elements = 0;

  csstree.walk(selector, (node) => {
    node.type === `IdSelector` && ids++;
    (node.type === `ClassSelector` || node.type === `AttributeSelector` || node.type === `PseudoClassSelector`) && classes++;
    (node.type === `TypeSelector` || node.type === `PseudoElementSelector`) && node.name !== `*` && elements++;
  });

  return [ids, classes, elements];
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const createLineStarts = (text: string): number[] => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    text.charCodeAt(i) === 10 && starts.push(i + 1);
  }
  return starts;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const getLineColumn = (lineStarts: number[], index: number): { col: number; line: number } => {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    }
    else {
      high = mid - 1;
    }
  }
  const line = Math.max(high, 0);
  return { line, col: index - lineStarts[line] };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isNameChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code === 45 || code === 95 || (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isHexDigit = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isCssWhitespace = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const readCssEscapeEnd = (text: string, start: number): number => {
  let index = start + 1;
  let hexCount = 0;
  while (index < text.length && hexCount < 6 && isHexDigit(text[index])) {
    index++;
    hexCount++;
  }
  if (hexCount > 0) {
    if (index < text.length && isCssWhitespace(text[index])) {
      index++;
    }
  }
  else if (index < text.length) {
    index++;
  }
  return index;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const unescapeCssIdentifier = (value: string): string => {
  let result = ``;
  let index = 0;
  while (index < value.length) {
    if (value[index] === `\\` && index + 1 < value.length) {
      let escapeIndex = index + 1;
      let hex = ``;
      while (escapeIndex < value.length && hex.length < 6 && isHexDigit(value[escapeIndex])) {
        hex += value[escapeIndex];
        escapeIndex++;
      }
      if (hex.length > 0) {
        const codePoint = Number.parseInt(hex, 16);
        result += codePoint > 0 && codePoint <= 0x10_ff_ff ? String.fromCodePoint(codePoint) : String.fromCodePoint(0xff_fd);
        if (escapeIndex < value.length && isCssWhitespace(value[escapeIndex])) {
          escapeIndex++;
        }
        index = escapeIndex;
      }
      else {
        result += value[escapeIndex];
        index = escapeIndex + 1;
      }
    }
    else {
      result += value[index];
      index++;
    }
  }
  return result;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isEscaped = (text: string, index: number): boolean => {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === `\\`; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const readSelectorNameEnd = (text: string, start: number): number => {
  let index = start;
  while (index < text.length) {
    if (text[index] === `\\` && index + 1 < text.length) {
      index = readCssEscapeEnd(text, index);
    }
    else if (isNameChar(text[index])) {
      index++;
    }
    else {
      break;
    }
  }
  return index;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const pushSelector = (positions: SelectorPos[], lineStarts: number[], absoluteIndex: number, rawSelector: string, marker: string, options?: ParseOptions): void => {
  const type = marker === `#` ? SelectorType.ID : SelectorType.CLASS;
  if (options?.filterByType !== undefined && options.filterByType !== type) {
    return;
  }
  const selector = unescapeCssIdentifier(rawSelector);
  if (!selector) {
    return;
  }
  const { line, col } = getLineColumn(lineStarts, absoluteIndex);
  positions.push({
    index: absoluteIndex,
    line,
    col,
    type,
    selector,
  });
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const scanSelectorPrelude = (positions: SelectorPos[], cssText: string, lineStarts: number[], start: number, end: number, options?: ParseOptions): void => {
  const rawPrelude = cssText.slice(start, end);
  const prelude = rawPrelude.trimStart();
  if (!prelude || prelude.startsWith(`@`)) {
    return;
  }
  let quote: string | null = null;
  let bracketDepth = 0;
  let inComment = false;
  const offset = start + rawPrelude.length - prelude.length;

  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i];
    const next = prelude[i + 1];
    if (inComment) {
      if (ch === `*` && next === `/`) {
        inComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === quote && !isEscaped(prelude, i)) {
        quote = null;
      }
      continue;
    }
    if (ch === `/` && next === `*`) {
      inComment = true;
      i++;
      continue;
    }
    if (ch === `"` || ch === `'`) {
      quote = ch;
      continue;
    }
    ch === `[` && bracketDepth++;
    ch === `]` && bracketDepth > 0 && bracketDepth--;
    if ((ch === `.` || ch === `#`) && bracketDepth === 0 && !isEscaped(prelude, i)) {
      const nameStart = i + 1;
      const nameEnd = readSelectorNameEnd(prelude, nameStart);
      nameEnd > nameStart && pushSelector(positions, lineStarts, offset + i, prelude.slice(nameStart, nameEnd), ch, options);
      i = nameEnd - 1;
    }
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const parseSelectorsWithCssTree = (cssText: string, options?: ParseOptions): SelectorPos[] => {
  const positions: SelectorPos[] = [];

  try {
    const ast = csstree.parse(cssText, DEFAULT_PARSE_OPTIONS);

    csstree.walk(ast, (node: csstree.CssNode) => {
      const isClass = node.type === `ClassSelector`;
      const isId = node.type === `IdSelector`;

      if (!isClass && !isId) {
      	return;
      }
      const type = isClass ? SelectorType.CLASS : SelectorType.ID;

      if (options?.filterByType !== undefined && options.filterByType !== type) {
      	return;
      }
      const loc = node.loc;
      if (!loc) {
      	return;
      }
      const selector = typeof node.name === `string` ? node.name.replaceAll(/\\/g, ``) : ``;
      const pos: ParsedSelector = {
        index: loc.start.offset,
        line: loc.start.line - 1,
        col: loc.start.column - 1,
        type,
        selector,
      };

      if (options?.includeSpecificity === true) {
        pos.specificity = calculateSpecificity(node);
      }

      positions.push(pos);
    });
  }
  catch {
    // 파싱 에러 발생 시 무시 (유효하지 않은 CSS일 수 있음)
  }
  return positions;
};

// MAIN PARSER ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const parseSelectors = (cssText: string, options?: ParseOptions): SelectorPos[] => {
  if (options?.includeSpecificity === true || options?.includeParentRule === true) {
    return parseSelectorsWithCssTree(cssText, options);
  }
  const positions: SelectorPos[] = [];
  const lineStarts = createLineStarts(cssText);
  let segmentStart = 0;
  let quote: string | null = null;
  let inComment = false;

  for (let i = 0; i < cssText.length; i++) {
    const ch = cssText[i];
    const next = cssText[i + 1];
    if (inComment) {
      if (ch === `*` && next === `/`) {
        inComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === quote && !isEscaped(cssText, i)) {
        quote = null;
      }
      continue;
    }
    if (ch === `/` && next === `*`) {
      inComment = true;
      i++;
      continue;
    }
    if (ch === `"` || ch === `'`) {
      quote = ch;
      continue;
    }
    if (ch === `{`) {
      scanSelectorPrelude(positions, cssText, lineStarts, segmentStart, i, options);
      segmentStart = i + 1;
    }
    else if (ch === `;`) {
      segmentStart = i + 1;
    }
    else if (ch === `}`) {
      segmentStart = i + 1;
    }
  }
  return positions;
};

// UTILITY FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const parseCssAst = (cssText: string): csstree.CssNode | null => {
  try {
    return csstree.parse(cssText, DEFAULT_PARSE_OPTIONS);
  }
  catch {
    return null;
  }
};

export const generateCss = (ast: csstree.CssNode): string => csstree.generate(ast);

export const walkCssAst = csstree.walk;
