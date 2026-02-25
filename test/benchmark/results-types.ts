export interface OptimizationFlags {
  parallelFiles:      boolean;
  parallelOperations: boolean;
  lazyFunctions:      boolean;
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
  fileCount:     number;
  timestamp:     string;
  wallMs:        PerformanceStats;
}