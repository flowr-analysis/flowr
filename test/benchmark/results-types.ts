import type { DataflowTimingBreakdown } from '../../src/dataflow/timing';
import type { FunctionDefTiming } from '../../src/dataflow/graph/graph';

export interface OptimizationFlags {
    parallelFiles:      boolean;
    parallelOperations: boolean;
    lazyFunctions:      boolean;
}

export interface GraphCheck {
    ok:        boolean;
    diffCount: number;
}

export enum CorrectnessClassification {
    Correct = 1,
    Imprecise = 2,
    Incorrect = 4,
}

export const enum CorrectnessClassificationName {
    Correct = 'correct',
    Imprecise = 'imprecise',
    Incorrect = 'incorrect',
}

const classificationToNameMap: ReadonlyMap<CorrectnessClassification, CorrectnessClassificationName> = new Map([
	[CorrectnessClassification.Correct, CorrectnessClassificationName.Correct],
	[CorrectnessClassification.Imprecise, CorrectnessClassificationName.Imprecise],
	[CorrectnessClassification.Incorrect, CorrectnessClassificationName.Incorrect],
]);

/** Convert the enum value to a stable, human-readable correctness classification name. */
export function correctnessClassificationToName(classification: CorrectnessClassification): CorrectnessClassificationName {
	return classificationToNameMap.get(classification) as CorrectnessClassificationName;
}

export interface CorrectnessResult {
    classification: CorrectnessClassification;
    diffCount:      number;
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

export type CorrectnessOutcome = 'skipped' | CorrectnessResult;

export interface AnalysisRunResult {
    project:                string;
    fileCount:              number;
    timestamp:              string;
    wallMs:                 number;
    timingBreakdown?:       DataflowTimingBreakdown;
    functionDefTimings?:    FunctionDefTiming[];
    correctness:            CorrectnessOutcome;
    lazyFunctionStats?:     LazyFunctionStats;
    sequentialReanalysis?:  boolean;
    graphMetrics?:          GraphMetrics;
    sourceCharacteristics?: SourceCharacteristics;
}

export interface ProjectResult {
    project:                      string;
    fileCount:                    number;
    timestamp:                    string;
    wallMsByThreads:              Record<string, number[]>;
    timingByThreads?:             Record<string, DataflowTimingBreakdown[]>;
    functionDefTimingsByThreads?: Record<string, FunctionDefTiming[][]>;
    correctnessByThreads:         Record<string, CorrectnessOutcome>;
    lazyFunctionStats?:           LazyFunctionStats;
    sequentialReanalysis?:        boolean;
    graphMetrics?:                GraphMetrics;
    sourceCharacteristics?:       SourceCharacteristics;
}

export interface CorrectnessStats {
    correct:   number;
    imprecise: number;
    incorrect: number;
    skipped:   number;
}

type FailedProjectBase =
    Record<'project' | 'detail', string> &
    Record<'reason', 'timeout' | 'exception'>;

export type FailedProjectResult = FailedProjectBase & {
    threadKey?: string;
    iteration?: number;
};

export type CorrectnessStatsByThreads = Record<string, CorrectnessStats>;

export interface BenchmarkSuiteResult {
    suiteName:                        string;
    projects:                         ProjectResult[];
    failedProjects:                   FailedProjectResult[];
    totalRuntimeMs:                   number;
    meanProjectRuntimeMs:             number;
    totalFiles:                       number;
    meanRuntimeMsByThreads?:          Record<string, number>;
    timingStatsByThreads?:            Record<string, DataflowTimingBreakdown>;
    functionDefTimingCountByThreads?: Record<string, number>;
    totalLazyFunctionStats?:          LazyFunctionStats;
    correctnessStatsByThreads?:       CorrectnessStatsByThreads;
    aggregateGraphMetrics?:           GraphMetrics;
    aggregateSourceStats?:            SourceCharacteristics;
}

export type BenchmarkResult = BenchmarkSuiteResult[];