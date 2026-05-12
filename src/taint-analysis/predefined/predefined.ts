import type { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { scaleAnalysis } from './scale-analysis';


export const predefinedTaintAnalyses = {
	'scale': scaleAnalysis,
} as const satisfies Record<string, TaintAnalysisDefinition>;

export type PredefinedTaintAnalysis = keyof typeof predefinedTaintAnalyses;