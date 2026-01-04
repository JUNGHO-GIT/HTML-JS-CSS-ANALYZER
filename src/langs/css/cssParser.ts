/**
 * @file cssParser.ts
 * @since 2025-11-22
 * @description CSS AST 기반 선택자 파서 (css-tree 라이브러리 사용)
 */

import { type SelectorPos, SelectorType } from "@exportTypes";
import * as csstree from "css-tree";

// TYPES -------------------------------------------------------------------------------------------
export type ParsedSelector = SelectorPos & {
  specificity?: [number, number, number];
  parentRule?: string;
};

export type ParseOptions = {
  includeSpecificity?: boolean;
  includeParentRule?: boolean;
  filterByType?: SelectorType;
};

// CONSTANTS ---------------------------------------------------------------------------------------
const DEFAULT_PARSE_OPTIONS: csstree.ParseOptions = {
  positions: true,
  parseAtrulePrelude: false,
  parseRulePrelude: true,
  parseValue: false,
};

// HELPERS -----------------------------------------------------------------------------------------
const calculateSpecificity = (selector: csstree.CssNode): [number, number, number] => {
  let ids = 0;
  let classes = 0;
  let elements = 0;

  csstree.walk(selector, (node) => {
    node.type === `IdSelector` && ids++;
    (node.type === `ClassSelector` || node.type === `AttributeSelector` || node.type === `PseudoClassSelector`) && classes++;
    (node.type === `TypeSelector` || node.type === `PseudoElementSelector`) && node.name !== `*` && elements++;
  });

  return [ ids, classes, elements ];
};

// MAIN PARSER -------------------------------------------------------------------------------------
export const parseSelectors = (cssText: string, options?: ParseOptions): SelectorPos[] => {
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
      const pos: ParsedSelector = {
        index: loc.start.offset,
        line: loc.start.line - 1,
        col: loc.start.column - 1,
        type,
        selector: node.name,
      };

      options?.includeSpecificity === true && (pos.specificity = calculateSpecificity(node));

      positions.push(pos);
    });
  }
  catch {
    // 파싱 에러 발생 시 무시 (유효하지 않은 CSS일 수 있음)
  }

  return positions;
};

// UTILITY FUNCTIONS -------------------------------------------------------------------------------
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
