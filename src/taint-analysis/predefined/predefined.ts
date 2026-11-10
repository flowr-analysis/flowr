import { normalizationKnownConstant, normalizationReach } from './normalization';
import type { TaintAnalysisDefinition, TaintAnalysisName, RunnableTaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { securityAnalysis } from './security-analysis';
import { randomnessAnalysis } from './randomness-analysis';
import { determinism } from './determinism';
import { secretAnalysis } from './secret-analysis';

export const predefinedTaintAnalyses = {
	'normalization-constant': normalizationKnownConstant,
	'normalization-reach':    normalizationReach,
	'security':               securityAnalysis,
	'randomness':             randomnessAnalysis,
	'determinism':            determinism,
	'secret':                 secretAnalysis
} as const satisfies AnalysisMap<['normalization-constant', 'normalization-reach', 'security', 'randomness', 'determinism', 'secret']>;

export const allPredefinedTaintAnalysisNames = Object.keys(predefinedTaintAnalyses) as AnyPredefinedTaintAnalysisName[];
export type AnyPredefinedTaintAnalysisName = keyof typeof predefinedTaintAnalyses;
export type AllPredefinedTaintAnalysisNames = [AnyPredefinedTaintAnalysisName];

type AnalysisMap<Defs extends readonly string[] = string[]> = {
	[key in TaintAnalysisName<TaintAnalysisDefinition<Defs[number]> | RunnableTaintAnalysisDefinition<Defs[number]>>]: RunnableTaintAnalysisDefinition<key>;
};

