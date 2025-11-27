/**
 * @file exportScripts.ts
 * @description Mock for script exports
 */

// Mock logger
export const logger = (level: string, message: string): void => {
	// Suppress logs during tests
};

export const initLogger = (): void => {};

// Mock isAnalyzable
export const isAnalyzable = (): boolean => true;

// Mock glob functions
export const globToRegExp = (glob: string): RegExp => {
	let s = glob.replace(/\\/g, `/`);
	s = s.replace(/[.+^${}()|[\]\\]/g, `\\$&`);
	s = s.replace(/\*\*/g, `§§DS§§`);
	s = s.replace(/\*/g, `[^/]*`);
	s = s.replace(/§§DS§§/g, `.*`);
	s = s.replace(/\?/g, `[^/]`);
	return new RegExp(`^${s}$`);
};

export const isUriExcludedByGlob = (): boolean => false;

// Mock performance functions
export const withPerformanceMonitoring = async <T>(name: string, fn: () => T | Promise<T>): Promise<T> => {
	return await fn();
};

export const performanceMonitor = {
	start: () => {},
	end: () => {},
};

export const resourceLimiter = () => ({
	execute: async <T>(fn: () => Promise<T>): Promise<T> => await fn(),
});

// Mock notification
export const notify = (): void => {};

// Mock validation
export const validateDocument = async (): Promise<never[]> => [];

// Mock diagnostic functions
export const scheduleValidate = (): void => {};
export const bindCssSupport = (): void => {};
export const updateDiagnostics = async (): Promise<void> => {};
export const clearAll = (): void => {};
export const onClosed = (): void => {};

// Re-export LineIndexMapper from actual implementation
export { LineIndexMapper, type LineIndex } from "../../src/assets/scripts/lineIndex";
