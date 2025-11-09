// src/utils/lineIndex.ts

// -------------------------------------------------------------------------------------------------
type FromIndexPos = {line: number; col: number;} | null;
type LineIndexMapperOverload = {
	(text: string, options?: {origin?: number;}): LineIndex;
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

// -------------------------------------------------------------------------------------------------
const objectToString = {}.toString;
const isArray = Array.isArray || ((value: unknown) => {
	return "[object Array]" === objectToString.call(value);
});
const isPlainObject = (value: unknown) => {
	return value != null && typeof value === "object" && !1 === isArray(value);
};

// -------------------------------------------------------------------------------------------------
export const LineIndexMapper: LineIndexMapperOverload = ((text: string, options?: {origin?: number;} | number): LineIndex | FromIndexPos => {
	const create = (sourceText: string, opts?: {origin?: number;}): LineIndex => {
		const str = sourceText || "";
		const lines = str.split("\n");
		const lineToIndex = new Array<number>(lines.length);
		let cursor = 0;
		for (let line = 0; line < lines.length; line++) {
			lineToIndex[line] = cursor;
			cursor += lines[line].length + 1;
		}
		const origin = opts && typeof opts.origin === "number" ? opts.origin : 0;

		const fromIndex = (idx: number): FromIndexPos => {
			if (idx < 0 || idx >= str.length || isNaN(idx)) {
				return null;
			}
			const l2i = lineToIndex;
			let lo = 0;
			let hi = l2i.length - 1;
			while (lo < hi) {
				const mid = (lo + hi + 1) >> 1;
				if (l2i[mid] <= idx) {
					lo = mid;
				}
				else {
					hi = mid - 1;
				}
			}
			return {line: lo + origin, col: idx - l2i[lo] + origin};
		};

		const toIndex = (line: number | number[] | {line: number; col?: number; column?: number;}, col?: number): number => {
			if (void 0 === col) {
				if (isArray(line) && (line as number[]).length >= 2) {
					return toIndex((line as number[])[0], (line as number[])[1]);
				}
				if (isPlainObject(line) && "line" in (line as any)) {
					const obj = line as {line: number; col?: number; column?: number;};
					return toIndex(obj.line, "col" in obj ? obj.col as number : obj.column as number);
				}
				return -1;
			}
			if (isNaN(line as number) || isNaN(col as number)) {
				return -1;
			}
			const l = (line as number) - origin;
			const c = (col as number) - origin;
			if (l >= 0 && c >= 0 && l < lineToIndex.length) {
				const base = lineToIndex[l];
				const end = l === lineToIndex.length - 1 ? (str.length) : lineToIndex[l + 1];
				if (base + c < end) {
					return base + c;
				}
			}
			return -1;
		};

		return {str, lineToIndex, origin, fromIndex, toIndex};
	};
	if (typeof options === "number") {
		return create(text).fromIndex(options);
	}
	else {
		return create(text, options);
	}
}) as LineIndexMapperOverload;
