// assets/scripts/performance.ts

import { logger } from "@exportScripts";
import type { PerformanceMetricsType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
let __pmInstance: {metrics: Map<string, PerformanceMetricsType>; start: (operationName: string) => string; end: (key: string) => number; checkMemoryUsage: () => void; cleanup: () => void;} | null = null;
export const performanceMonitor = () => {
	if (!__pmInstance) {
		__pmInstance = {
			metrics: new Map<string, PerformanceMetricsType>(),
			start(operationName: string): string {
				const key = `${operationName}_${Date.now()}_${Math.random()}`;
				this.metrics.set(key, { startTime: performance.now(), operationName });
				return key;
			},
			end(key: string): number {
				const metric = this.metrics.get(key);
				if (!metric) {
					return -1;
				}
				const duration = performance.now() - metric.startTime;
				const formattedDuration = Math.round(duration * 100) / 100;
				if (duration > 500) {
					  logger(`debug`, `Performance`, `Slow operation: ${metric.operationName} took ${formattedDuration}ms`);
				}
				else if (duration > 100) {
					  logger(`debug`, `Performance`, `Timing: ${metric.operationName} took ${formattedDuration}ms`);
				}
				this.metrics.delete(key);
				return duration;
			},
			checkMemoryUsage(): void {
				if ((global as any).gc && typeof (global as any).gc === 'function') {
					(global as any).gc();
				}
				const usage = process.memoryUsage();
				const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100;
				const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100;
				if (heapUsedMB > 100) {
					  logger(`debug`, `Performance`, `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
				}
			},
			cleanup(): void {
				this.metrics.clear();
			}
		};
	}
	return __pmInstance;
};

// -------------------------------------------------------------------------------------------------
export const withPerformanceMonitoring = async <T>(
	operationName: string,
	operation: () => Promise<T> | T
): Promise<T> => {
	const key = performanceMonitor().start(operationName);
	try {
		const result = await operation();
		return result;
	}
	finally {
		performanceMonitor().end(key);
	}
};

// -------------------------------------------------------------------------------------------------
export const throttle = <T extends (...args: any[]) => any>(
	func: T,
	limit: number
): T => {
	let inThrottle: boolean;
	return ((...args: any[]) => {
		if (!inThrottle) {
			func.apply(null, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	}) as T;
};

// -------------------------------------------------------------------------------------------------
export const debounce = <T extends (...args: any[]) => any>(
	func: T,
	delay: number
): T => {
	let timeoutId: NodeJS.Timeout;
	return ((...args: any[]) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(null, args), delay);
	}) as T;
};

// -------------------------------------------------------------------------------------------------
type ResourceLimiterType = { MAX_CONCURRENT_OPERATIONS: number; activeOperations: number; queue: (() => void)[]; execute: <T>(operation: () => Promise<T>) => Promise<T>; processQueue: () => void; };
let __rlInstance: ResourceLimiterType | null = null;
export const resourceLimiter = () => {
	if (!__rlInstance) {
		__rlInstance = {
			MAX_CONCURRENT_OPERATIONS: 5,
			activeOperations: 0,
			queue: [] as (() => void)[],
			async execute<T>(operation: () => Promise<T>): Promise<T> {
				return new Promise<T>((resolve, reject) => {
					const executeOperation = async () => {
						this.activeOperations++;
						try {
							const result = await operation();
							resolve(result);
						}
						catch (error) {
							reject(error);
						}
						finally {
							this.activeOperations--;
							this.processQueue();
						}
					};
					if (this.activeOperations < this.MAX_CONCURRENT_OPERATIONS) {
						executeOperation();
					}
					else {
						this.queue.push(executeOperation);
					}
				});
			},
			processQueue(): void {
				if (this.queue.length > 0 && this.activeOperations < this.MAX_CONCURRENT_OPERATIONS) {
					const operation = this.queue.shift();
					operation && operation();
				}
			}
		};
	}
	return __rlInstance;
};