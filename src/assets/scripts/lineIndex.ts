/**
 * @file lineIndex.ts
 * @since 2026-01-04
 * @description 라인/컨럼 오프셋 인덱스 매퍼
 */

// TYPE DEFINITIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
type FromIndexPos = { line: number; col: number } | null;
type LineIndexMapperOverload = {
  (text: string, options?: { origin?: number }): LineIndex;
  (text: string, options: number): FromIndexPos;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export type LineIndex = {
  str: string;
  lineToIndex: number[];
  origin: number;
  fromIndex: (idx: number) => FromIndexPos;
  toIndex: (line: number, col?: number) => number;
};

// HELPERS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
const objectToString = {}.toString;
const isArray = Array.isArray || ((value: unknown) => objectToString.call(value) === `[object Array]`);
const isPlainObject = (value: unknown) => value != null && typeof value === `object` && !1 === isArray(value);

// MAIN FUNCTION ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export const LineIndexMapper: LineIndexMapperOverload = ((text: string, options?: { origin?: number } | number): LineIndex | FromIndexPos => {
  const fnCreate = (sourceText: string, opts?: { origin?: number }): LineIndex => {
    const str = sourceText || ``;
    const lines = str.split(`\n`);
    const lineToIndex: number[] = Array.from({ length: lines.length }, () => 0);
    let cursor = 0;
    for (const [line, line_] of lines.entries()) {
      lineToIndex[line] = cursor;
      cursor += line_.length + 1;
    }
    const origin = opts && typeof opts.origin === `number` ? opts.origin : 0;

    const fromIndex = (idx: number): FromIndexPos => {
      const rs = idx < 0 || idx >= str.length || Number.isNaN(idx) ? null : (() => {
            const l2i = lineToIndex;
            let lo = 0;
            let hi = l2i.length - 1;
            while (lo < hi) {
              const mid = (lo + hi + 1) >> 1;
              l2i[mid] <= idx ? (lo = mid) : (hi = mid - 1);
            }
            return { line: lo + origin, col: idx - l2i[lo] + origin };
          })();
      return rs;
    };

    const toIndex = (line: number | number[] | { line: number; col?: number; column?: number }, col?: number): number => {
      const rs = void 0 === col ? isArray(line) && line.length >= 2 ? toIndex(line[0], line[1]) : isPlainObject(line) && `line` in (line as any) ? (() => {
              const obj = line as { line: number; col?: number; column?: number };
              const v = `col` in obj ? (obj.col as number) : (obj.column as number);
              return toIndex(obj.line, v);
            })() : -1 : Number.isNaN(line as number) || Number.isNaN(col) ? -1 : (() => {
            const l = (line as number) - origin;
            const c = col - origin;
            const v = l >= 0 && c >= 0 && l < lineToIndex.length ? (() => {
                  const base = lineToIndex[l];
                  const end = l === lineToIndex.length - 1 ? str.length : lineToIndex[l + 1];
                  const r = base + c < end ? base + c : -1;
                  return r;
                })() : -1;
            return v;
          })();
      return rs;
    };

    return { str, lineToIndex, origin, fromIndex, toIndex };
  };
  const rs = typeof options === `number` ? fnCreate(text).fromIndex(options) : fnCreate(text, options);
  return rs;
}) as LineIndexMapperOverload;
