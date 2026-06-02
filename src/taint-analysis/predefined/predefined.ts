import { scaleAnalysis } from './scale-analysis';
import type { TaintAnalysisDefinition, TaintAnalysisName } from '../builder/taint-analysis-definition';

export const predefinedTaintAnalyses = {
	'scale': scaleAnalysis,
} as const satisfies AnalysisMap<['scale']>;

export type PredefinedTaintAnalysis = keyof typeof predefinedTaintAnalyses;

type AnalysisMap<Defs extends readonly string[] = string[]> = {
	[key in TaintAnalysisName<TaintAnalysisDefinition<Defs[number]>>]: TaintAnalysisDefinition<key>;
};

