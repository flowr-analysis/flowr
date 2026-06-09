import { scaleAnalysis } from './scale-analysis';
import type { TaintAnalysisDefinition, TaintAnalysisName, RunnableTaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { securityAnalysis } from './security-analysis';
import { randomnessAnalysis } from './randomness-analysis';
import { determinism } from './determinism';

export const predefinedTaintAnalyses = {
	'scale':       scaleAnalysis,
	'security':    securityAnalysis,
	'randomness':  randomnessAnalysis,
	'determinism': determinism
} as const satisfies AnalysisMap<['scale', 'security', 'randomness', 'determinism']>;

export type AnyPredefinedTaintAnalysisName = keyof typeof predefinedTaintAnalyses;
export type AllPredefinedTaintAnalysisNames = [AnyPredefinedTaintAnalysisName];

type AnalysisMap<Defs extends readonly string[] = string[]> = {
	[key in TaintAnalysisName<TaintAnalysisDefinition<Defs[number]> | RunnableTaintAnalysisDefinition<Defs[number]>>]: RunnableTaintAnalysisDefinition<key>;
};

