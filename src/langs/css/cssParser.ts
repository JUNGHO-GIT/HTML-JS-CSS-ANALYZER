/**
 * @file cssParser.ts
 * @since 2025-11-22
 */

import { type SelectorPos, SelectorType } from "@exportTypes";
import * as csstree from "css-tree";

// -------------------------------------------------------------------------------------------------
// CSS 선택자 파서 (css-tree 라이브러리 사용)
export const parseSelectors = (cssText: string): SelectorPos[] => {
	const positions: SelectorPos[] = [];

	try {
		const ast = csstree.parse(cssText, {
			positions: true,
			parseAtrulePrelude: false,
			parseRulePrelude: true,
			parseValue: false
		});

		csstree.walk(ast, (node) => {
			if (node.type === `ClassSelector` || node.type === `IdSelector`) {
				if (node.loc) {
					positions.push({
						index: node.loc.start.offset,
						line: node.loc.start.line - 1,
						col: node.loc.start.column - 1,
						type: node.type === `ClassSelector` ? SelectorType.CLASS : SelectorType.ID,
						selector: node.name
					});
				}
			}
		});
	}
	catch (error) {
		// 파싱 에러 발생 시 무시 (유효하지 않은 CSS일 수 있음)
	}

	return positions;
};
