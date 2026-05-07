import { Scaled, ScaleDomain, Unscaled } from './scale-domain';
import { Bottom, Top } from '../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from './builder/taint-analysis-definition';

const scaleAnalysis = new TaintAnalysisDefinition('Scale', new ScaleDomain(Top))
	.through({
		'c':     { taint: Unscaled },
		'scale': { taint: Scaled },
	})
	.to({
		'mean': {
			taint: {
				pos:  0,
				cond: (taint) => taint == Scaled ? Bottom : taint
			}
		},
	})
	.report('Warning: Mean of scaled value is always zero');

export const predefinedTaintAnalyses = {
	'scale': scaleAnalysis,
} as const satisfies Record<string, TaintAnalysisDefinition>;

export type PredefinedTaintAnalysis = keyof typeof predefinedTaintAnalyses;