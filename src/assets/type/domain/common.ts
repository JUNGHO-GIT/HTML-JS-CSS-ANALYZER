/**
 * @file common.ts
 * @since 2026-01-04
 * @description 공통 타입 정의 (enum, type)
 */

// ENUM DEFINITIONS --------------------------------------------------------------------------------
export enum AutoValidationMode {
  NEVER = `Never`,
  SAVE = `Save`,
  ALWAYS = `Always`,
  FORCE = `__Force__`,
}

// -------------------------------------------------------------------------------------------------
export enum SelectorType {
  ID = `#`,
  CLASS = `.`,
}

// TYPE DEFINITIONS --------------------------------------------------------------------------------
export type SelectorPos = {
  index: number;
  line: number;
  col: number;
  type: SelectorType;
  selector: string;
};
