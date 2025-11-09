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
		`[html-css-js] [${key}] ${value}`
	);
	type === `info` && console.info(
		`[html-css-js] [${key}] ${value}`
	);
	type === `warn` && console.warn(
		`[html-css-js] [${key}] ${value}`
	);
	type === `error` && console.error(
		`[html-css-js] [${key}] ${value}`
	);
};