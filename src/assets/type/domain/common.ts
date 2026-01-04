/**
 * @file common.ts
 * @description foo
 * @author Jungho
 * @since 2026-1-4
 */

// -------------------------------------------------------------------------------------------------
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

// -------------------------------------------------------------------------------------------------
export type SelectorPos = {
  index: number;
  line: number;
  col: number;
  type: SelectorType;
  selector: string;
};
