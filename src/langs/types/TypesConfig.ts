// langs/types/TypesConfig.ts

// -------------------------------------------------------------------------------
export declare type AutoValidationModeType = "Never" | "Save" | "Always" | "__Force__";

// -------------------------------------------------------------------------------
export declare type LogLevelType = "off" | "error" | "info" | "debug";

// -------------------------------------------------------------------------------
export declare type LogTypeType = "debug" | "info" | "warn" | "error";

// -------------------------------------------------------------------------------
export declare type PerformanceMetricsType = {
  startTime: number;
  operationName: string;
};

// -------------------------------------------------------------------------------
export declare type UnusedSeverityType = never;