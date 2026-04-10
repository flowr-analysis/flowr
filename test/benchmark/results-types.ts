export interface OptimizationFlags {
    parallelFiles:      boolean;
    parallelOperations: boolean;
    lazyFunctions:      boolean;
}

export interface PerformanceStats {
    mean:       number;
    median:     number;
    min:        number;
    max:        number;
    stddev:     number;
    p90:        number;
    p95:        number;
    dataPoints: number[];
}

export interface LazyFunctionStats {
    totalFunctionDefinitions:  number;
    lazyFunctionsMaterialized: number;
    lazyFunctionsRemaining:    number;
}

export interface GraphMetrics {
    nodeCount:            number;
    nodeTypeDistribution: Record<string, number>;
    sideEffectCount:      number;
}

export interface SourceCharacteristics {
    lineCount:  number;
    totalBytes: number;
    fileCount:  number;
}

export interface WorkerResult {
    project:                string;
    threads?:               number;
    correctness:            'skipped' | { ok: boolean; diffCount: number; diff?: readonly string[] };
    fileCount:              number;
    timestamp:              string;
    wallMs:                 PerformanceStats;
    lazyFunctionStats?:     LazyFunctionStats;
    graphMetrics?:          GraphMetrics;
    sourceCharacteristics?: SourceCharacteristics;
}