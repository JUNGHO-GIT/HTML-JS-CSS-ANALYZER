// src/utils/performance.ts

import {log} from "./logger.js";

// -------------------------------------------------------------------------------------------------
interface PerformanceMetrics {
	startTime: number;
	operationName: string;
}

// -------------------------------------------------------------------------------------------------
export class PerformanceMonitor {
	private static metrics: Map<string, PerformanceMetrics> = new Map();

	// 성능 측정 시작
	static start(operationName: string): string {
		const key = `${operationName}_${Date.now()}_${Math.random()}`;
		this.metrics.set(key, {
			startTime: performance.now(),
			operationName
		});
		return key;
	}

	// 성능 측정 종료 및 로깅
	static end(key: string): number {
		const metric = this.metrics.get(key);
		if (!metric) {
			return -1;
		}

		const duration = performance.now() - metric.startTime;
		const formattedDuration = Math.round(duration * 100) / 100;

		// 느린 작업 경고 (500ms 이상)
		if (duration > 500) {
			log("info", `[Html-Js-Css-Analyzer] Slow operation detected: ${metric.operationName} took ${formattedDuration}ms`);
		}
		else if (duration > 100) {
			log("debug", `[Html-Js-Css-Analyzer] Operation timing: ${metric.operationName} took ${formattedDuration}ms`);
		}

		this.metrics.delete(key);
		return duration;
	}

	// 메모리 사용량 체크
	static checkMemoryUsage(): void {
		if (global.gc && typeof global.gc === 'function') {
			global.gc();
		}

		const usage = process.memoryUsage();
		const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100;
		const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100;

		if (heapUsedMB > 100) { // 100MB 이상
			log("info", `[Html-Js-Css-Analyzer] High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
		}
	}

	// 정리
	static cleanup(): void {
		this.metrics.clear();
	}
}

// -------------------------------------------------------------------------------------------------
export const withPerformanceMonitoring = async <T>(
	operationName: string,
	operation: () => Promise<T> | T
): Promise<T> => {
	const key = PerformanceMonitor.start(operationName);
	try {
		const result = await operation();
		return result;
	}
	finally {
		PerformanceMonitor.end(key);
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
export class ResourceLimiter {
	private static readonly MAX_CONCURRENT_OPERATIONS = 5;
	private static activeOperations = 0;
	private static queue: (() => void)[] = [];

	static async execute<T>(operation: () => Promise<T>): Promise<T> {
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
	}

	private static processQueue(): void {
		if (this.queue.length > 0 && this.activeOperations < this.MAX_CONCURRENT_OPERATIONS) {
			const operation = this.queue.shift();
			operation && operation();
		}
	}
}