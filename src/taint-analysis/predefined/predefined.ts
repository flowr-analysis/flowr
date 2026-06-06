import { scaleAnalysis } from './scale-analysis';
import type { TaintAnalysisDefinition, TaintAnalysisName } from '../builder/taint-analysis-definition';
import { securityAnalysis } from './security-analysis';
import { randomnessAnalysis } from './randomness-analysis';

export const predefinedTaintAnalyses = {
	'scale':      scaleAnalysis,
	'security':   securityAnalysis,
	'randomness': randomnessAnalysis
} as const satisfies AnalysisMap<['scale', 'security', 'randomness']>;

export type AnyPredefinedTaintAnalysisName = keyof typeof predefinedTaintAnalyses;
export type AllPredefinedTaintAnalysisNames = [AnyPredefinedTaintAnalysisName];

type AnalysisMap<Defs extends readonly string[] = string[]> = {
	[key in TaintAnalysisName<TaintAnalysisDefinition<Defs[number]>>]: TaintAnalysisDefinition<key>;
};

