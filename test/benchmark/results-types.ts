export interface OptimizationFlags {
    parallelFiles:      boolean;
    parallelOperations: boolean;
    lazyFunctions:      boolean;
}

export interface GraphCheck {
    ok:        boolean;
    diffCount: number;
    diff?:     readonly string[];
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
    diff?:          readonly string[];
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
    correctness:            CorrectnessOutcome;
    lazyFunctionStats?:     LazyFunctionStats;
    sequentialReanalysis?:  boolean;
    graphMetrics?:          GraphMetrics;
    sourceCharacteristics?: SourceCharacteristics;
}

export interface ProjectResult {
    project:                string;
    fileCount:              number;
    timestamp:              string;
    wallMsByThreads:        Record<string, number[]>;
    correctnessByThreads:   Record<string, CorrectnessOutcome>;
    lazyFunctionStats?:     LazyFunctionStats;
    sequentialReanalysis?:  boolean;
    graphMetrics?:          GraphMetrics;
    sourceCharacteristics?: SourceCharacteristics;
}

export interface CorrectnessStats {
    correct:   number;
    imprecise: number;
    incorrect: number;
    skipped:   number;
}

export type CorrectnessStatsByThreads = Record<string, CorrectnessStats>;

export interface BenchmarkSuiteResult {
    suiteName:                  string;
    projects:                   ProjectResult[];
    totalRuntimeMs:             number;
    meanProjectRuntimeMs:       number;
    totalFiles:                 number;
    totalLazyFunctionStats?:    LazyFunctionStats;
    correctnessStatsByThreads?: CorrectnessStatsByThreads;
    aggregateGraphMetrics?:     GraphMetrics;
    aggregateSourceStats?:      SourceCharacteristics;
}

export type BenchmarkResult = BenchmarkSuiteResult[];