// assets/scripts/logger.ts

// -----------------------------------------------------------------------------------------
export const logger = (
	type:
	`debug` |
	`info` |
	`warn` |
	`error`,
	key: string,
	value: string,
): void => {
	type === `debug` && console.debug(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `info` && console.info(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `warn` && console.warn(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `error` && console.error(
		`[Html-Js-Css] [${key}] ${value}`
	);
};