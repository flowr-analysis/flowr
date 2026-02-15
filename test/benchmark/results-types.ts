export interface OptimizationFlags {
  parallelFiles:      boolean;
  parallelOperations: boolean;
  lazyFunctions:      boolean;
}

export interface PerformanceMetricsStats {
  wallMs:        PerformanceStats;
  cpuUserMs:     PerformanceStats;
  cpuSystemMs:   PerformanceStats;
  rssMax:        PerformanceStats;
  heapUsedMax:   PerformanceStats;
  heapTotalMax:  PerformanceStats;
  cpuUtilApprox: PerformanceStats;
}

export interface PerformanceStats {
  mean:   number;
  median: number;
  min:    number;
  max:    number;
  stddev: number;
  p90:    number;
  p95:    number;
}

export interface WorkerResult {
  project:       string;
  repetitions:   number;
  threads?:      number;
  optimizations: OptimizationFlags;
  correctness:   'skipped' | { ok: boolean; diffCount: number; diff?: readonly string[] };
  physicalCores: number;
  noStats:       boolean;
  warmup:        boolean;
  gcBeforeRun:   boolean;
  fileCount:     number;
  timestamp:     string;
  stats:         PerformanceMetricsStats;
}