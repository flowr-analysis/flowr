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

export interface SequentialReanalysisInfo {
    triggered:  boolean;
    iteration?: number;
    fileIndex?: number;
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
    correctness:            'skipped' | CorrectnessResult;
    fileCount:              number;
    timestamp:              string;
    wallMs:                 number[];
    lazyFunctionStats?:     LazyFunctionStats;
    sequentialReanalysis?:  SequentialReanalysisInfo;
    graphMetrics?:          GraphMetrics;
    sourceCharacteristics?: SourceCharacteristics;
}