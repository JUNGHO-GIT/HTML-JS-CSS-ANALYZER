// langs/css/CssParser.ts

import { regexSelectorBoundary, regexLeadingWhitespace } from "@exportConsts";
import { lineIndexMapper } from "@exportScripts";
import type { SelectorPosType, LineIndexDataType } from "@exportTypes";

// CSS 선택자 파서 ----------------------------------------------------------------------------------
export const parseSelectors = (cssText: string): SelectorPosType[] => {
	const positions: SelectorPosType[] = [];
	const mapper = lineIndexMapper(cssText, {origin: 0}) as LineIndexDataType;

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
				((ch === "." || ch === "#") && prev !== "\\") && (() => {
					let j = i + 1;
					let value = "";
					while (j < frag.length) {
						const c = frag[j];
						c === "\\" && j + 1 < frag.length ? (value += frag[j + 1], j += 2) : (regexSelectorBoundary.test(c) ? (j = frag.length) : (value += c, j++));
						c === "\\" && j + 1 >= frag.length && (j++);
					}
					value.length > 0 && (() => {
						const absIdx = baseIndex + p.offset + i;
						const pos = mapper.fromIndex(absIdx);
						pos && positions.push({
							index: absIdx,
							line: pos.line,
							col: pos.col,
							type: ch === "#" ? "#" : ".",
							selector: value
						});
					})();
					i = j - 1;
				})();
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
			const rawPrelude = cssText.slice(preludeStart, i);
			const leading = regexLeadingWhitespace.exec(rawPrelude)?.[0].length || 0;
			const prelude = rawPrelude.trim();
			prelude.length > 0 && !prelude.startsWith("@") && extractFromPrelude(prelude, preludeStart + leading);
			depth++;
			preludeStart = i + 1;
		}

		if (ch === "}") {
			if (depth > 0) {
				depth--;
			}
			preludeStart = i + 1;
		}
	}

	return positions;
};
