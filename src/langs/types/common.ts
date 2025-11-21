// common.ts

// -------------------------------------------------------------------------------------------------
export enum AutoValidationMode {
	NEVER = `Never`,
	SAVE = `Save`,
	ALWAYS = `Always`,
	FORCE = `__Force__`
}

// -------------------------------------------------------------------------------------------------
export enum SelectorType {
	ID = `#`,
	CLASS = `.`
}

// -------------------------------------------------------------------------------------------------
export type SelectorPos = {
	index: number;
	line: number;
	col: number;
	type: SelectorType;
	selector: string;
};
