/**
 * @file performance.ts
 * @since 2026-01-04
 * @description 성능 모니터링 및 리소스 제한
 */

import { logger } from "@exportScripts";
import type { PerformanceMetricsType as PerfMtrcTyp } from "@exportTypes";

// TYPE DEFINITIONS --------------------------------------------------------------------------------
type PerfMonitor = {
  metrics: Map<string, PerfMtrcTyp>;
  start: (operationName: string) => string;
  end: (key: string) => number;
  checkMemoryUsage: () => void;
  cleanup: () => void;
};
type ResourceLimiterType = {
  MAX_CONCURRENT_OPERATIONS: number;
  activeOperations: number;
  queue: (() => void)[];
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  processQueue: () => void;
};

// SLOW/TIMING THRESHOLDS -------------------------------------------------------------------------
const SLOW_OP_MS = 500;
const TIMING_OP_MS = 100;
const HIGH_HEAP_MB = 100;

// PERFORMANCE MONITOR -----------------------------------------------------------------------------
let monitorInstance: PerfMonitor | null = null;

export const performanceMonitor = (): PerfMonitor => {
  if (monitorInstance) {
    return monitorInstance;
  }
  monitorInstance = {
    metrics: new Map<string, PerfMtrcTyp>(),
    start(operationName: string): string {
      const key = `${operationName}_${Date.now()}_${Math.random()}`;
      this.metrics.set(key, { startTime: performance.now(), operationName: operationName });
      return key;
    },
    end(key: string): number {
      const metric = this.metrics.get(key);
      if (!metric) {
        return -1;
      }
      const duration = performance.now() - metric.startTime;
      const formattedDuration = Math.round(duration * 100) / 100;
      if (duration > SLOW_OP_MS) {
        logger(`debug`, `Slow operation: ${metric.operationName} took ${formattedDuration}ms`);
      }
      else if (duration > TIMING_OP_MS) {
        logger(`debug`, `Timing: ${metric.operationName} took ${formattedDuration}ms`);
      }
      this.metrics.delete(key);
      return duration;
    },
    checkMemoryUsage(): void {
      const glbl = globalThis as { gc?: () => void };
      if (typeof glbl.gc === `function`) {
        glbl.gc();
      }
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
      const heapTotalMB = Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100;
      if (heapUsedMB > HIGH_HEAP_MB) {
        logger(`debug`, `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
      }
    },
    cleanup(): void {
      this.metrics.clear();
    },
  };
  return monitorInstance;
};

// -------------------------------------------------------------------------------------------------
export const withPerformanceMonitoring = async <T>(operationName: string, operation: () => Promise<T> | T): Promise<T> => {
  const key = performanceMonitor().start(operationName);
  try {
    const result = await operation();
    return result;
  }
  finally {
    performanceMonitor().end(key);
  }
};

// RESOURCE LIMITER ---------------------------------------------------------------------------------
let limiterInstance: ResourceLimiterType | null = null;

export const resourceLimiter = (): ResourceLimiterType => {
  if (limiterInstance) {
    return limiterInstance;
  }
  limiterInstance = {
    MAX_CONCURRENT_OPERATIONS: 5,
    activeOperations: 0,
    queue: [] as (() => void)[],
    async execute<T>(operation: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const fnExecute = async () => {
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
          void fnExecute();
        }
        else {
          this.queue.push(fnExecute);
        }
      });
    },
    processQueue(): void {
      while (this.queue.length > 0 && this.activeOperations < this.MAX_CONCURRENT_OPERATIONS) {
        const operation = this.queue.shift();
        operation?.();
      }
    },
  };
  return limiterInstance;
};
