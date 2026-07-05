/**
 * @file lineIndex.ts
 * @since 2026-01-04
 * @description 라인/컬럼 오프셋 인덱스 매퍼
 */

// TYPE DEFINITIONS --------------------------------------------------------------------------------
type FromIndexPos = { line: number; col: number } | null;
type ToIndexInput = number | number[] | { line: number; col?: number; column?: number };
type LineIndexMapperOverload = {
  (text: string, options?: { origin?: number }): LineIndex;
  (text: string, options: number): FromIndexPos;
};

// -------------------------------------------------------------------------------------------------
export type LineIndex = {
  str: string;
  lineToIndex: number[];
  origin: number;
  fromIndex: (idx: number) => FromIndexPos;
  toIndex: (line: number, col?: number) => number;
};

// HELPERS -----------------------------------------------------------------------------------------
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === `object` && !Array.isArray(value);

// MAIN FUNCTION -----------------------------------------------------------------------------------
const createIndex = (sourceText: string, opts?: { origin?: number }): LineIndex => {
  const str = sourceText || ``;
  const lines = str.split(`\n`);
  const lineToIndex: number[] = new Array<number>(lines.length).fill(0);
  let cursor = 0;
  for (const [line, content] of lines.entries()) {
    lineToIndex[line] = cursor;
    cursor += content.length + 1;
  }
  const origin = opts && typeof opts.origin === `number` ? opts.origin : 0;

  const fromIndex = (idx: number): FromIndexPos => {
    if (Number.isNaN(idx) || idx < 0 || idx >= str.length) {
      return null;
    }
    let lo = 0;
    let hi = lineToIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineToIndex[mid] <= idx) {
        lo = mid;
      }
      else {
        hi = mid - 1;
      }
    }
    return { line: lo + origin, col: idx - lineToIndex[lo] + origin };
  };

  const toIndex = (line: ToIndexInput, col?: number): number => {
    if (col === undefined) {
      if (Array.isArray(line) && line.length >= 2) {
        return toIndex(line[0], line[1]);
      }
      if (isPlainObject(line) && `line` in line) {
        const obj = line as { line: number; col?: number; column?: number };
        const resolvedCol = `col` in obj ? obj.col : obj.column;
        return toIndex(obj.line, resolvedCol);
      }
      return -1;
    }
    if (Number.isNaN(line as number) || Number.isNaN(col)) {
      return -1;
    }
    const l = (line as number) - origin;
    const c = col - origin;
    if (l < 0 || c < 0 || l >= lineToIndex.length) {
      return -1;
    }
    const base = lineToIndex[l];
    const end = l === lineToIndex.length - 1 ? str.length : lineToIndex[l + 1];
    return base + c < end ? base + c : -1;
  };

  return { str, lineToIndex, origin, fromIndex, toIndex };
};

// -------------------------------------------------------------------------------------------------
export const LineIndexMapper: LineIndexMapperOverload = ((text: string, options?: { origin?: number } | number): LineIndex | FromIndexPos => {
  if (typeof options === `number`) {
    return createIndex(text).fromIndex(options);
  }
  return createIndex(text, options);
}) as LineIndexMapperOverload;
