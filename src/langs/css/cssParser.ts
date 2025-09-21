// src/langs/css/cssParser.ts

import {type LineIndex, LineIndexMapper} from "../../utils/lineIndex.js";
import {type SelectorPos, SelectorType} from "../types/common.js";

// CSS 선택자 파서 ---------------------------------------------------------------------------------
export const parseSelectors = (cssText: string): SelectorPos[] => {
	const positions: SelectorPos[] = [];
	const mapper = LineIndexMapper(cssText, {origin: 0}) as LineIndex;

	let depth = 0;
	let inStr: "'" | '"' | "`" | null = null;
	let inComment = 0;
	let preludeStart = 0;

	const extractFromPrelude = (prelude: string, baseIndex: number) => {
		const parts: Array<{text: string; offset: number;}> = [];
		let partStart = 0;
		let sInStr: "'" | '"' | "`" | null = null;
		let sInBracket = 0;

		for (let i = 0; i < prelude.length; i++) {
			const ch = prelude[i];
			const prev = i > 0 ? prelude[i - 1] : "";
			if (sInStr) {
				if (ch === sInStr && prev !== "\\") {
					sInStr = null;
				}
			}
			else {
				if (ch === "'" || ch === '"' || ch === "`") {
					sInStr = ch as unknown as typeof sInStr;
				}
				else {
					if (ch === "(" || ch === "[" || ch === "{") {
						sInBracket++;
					}
					else {
						if (ch === ")" || ch === "]" || ch === "}") {
							if (sInBracket > 0) {
								sInBracket--;
							}
						}
						else {
							if (ch === "," && sInBracket === 0) {
								parts.push({text: prelude.slice(partStart, i), offset: partStart});
								partStart = i + 1;
							}
						}
					}
				}
			}
		}
		parts.push({text: prelude.slice(partStart), offset: partStart});

		for (const p of parts) {
			const frag = p.text;
			for (let i = 0; i < frag.length; i++) {
				const ch = frag[i];
				const prev = i > 0 ? frag[i - 1] : "";
				if ((ch === "." || ch === "#") && prev !== "\\") {
					let j = i + 1;
					let value = "";
					while (j < frag.length) {
						const c = frag[j];
						if (c === "\\") {
							if (j + 1 < frag.length) {
								value += frag[j + 1];
								j += 2;
								continue;
							}
							else {
								j++;
								continue;
							}
						}
						if (/\s|[#.:,[\]()>+~=*^$|{}]/.test(c)) {
							break;
						}
						value += c;
						j++;
					}
					if (value.length > 0) {
						const absIdx = baseIndex + p.offset + i;
						const pos = mapper.fromIndex(absIdx);
						if (pos) {
							positions.push({
								index: absIdx,
								line: pos.line,
								col: pos.col,
								type: ch === "#" ? SelectorType.ID : SelectorType.CLASS,
								selector: value
							});
						}
					}
					i = j - 1;
				}
			}
		}
	};

	for (let i = 0; i < cssText.length; i++) {
		const ch = cssText[i];
		const prev = i > 0 ? cssText[i - 1] : "";

		if (inComment === 1) {
			if (prev === "*" && ch === "/") {
				inComment = 0;
			}
			continue;
		}
		else {
			if (inComment === 2) {
				if (ch === "\n") {
					inComment = 0;
				}
				continue;
			}
		}

		if (!inStr) {
			if (prev === "/" && ch === "*") {
				inComment = 1;
				continue;
			}
			if (prev === "/" && ch === "/") {
				inComment = 2;
				continue;
			}
		}

		if (inStr) {
			if (ch === inStr && prev !== "\\") {
				inStr = null;
			}
			continue;
		}
		else {
			if (ch === "'" || ch === '"' || ch === "`") {
				inStr = ch as unknown as typeof inStr;
				continue;
			}
		}

		if (ch === "{") {
			if (depth === 0) {
				const rawPrelude = cssText.slice(preludeStart, i);
				// leading whitespace 길이 측정하여 baseIndex 보정
				const leading = rawPrelude.match(/^\s*/)?.[0].length || 0;
				const prelude = rawPrelude.trim();
				if (prelude.length > 0) {
					extractFromPrelude(prelude, preludeStart + leading);
				}
			}
			depth++;
			continue;
		}
		if (ch === "}") {
			if (depth > 0) {
				depth--;
				if (depth === 0) {
					preludeStart = i + 1;
				}
			}
			continue;
		}
	}

	return positions;
};
