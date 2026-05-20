import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';

export const Unscaled = Symbol('Unscaled');
export const Scaled = Symbol('Scaled');

export const scaleDomain = new FiniteDomainBuilder()
	.addElements(Unscaled, Scaled)
	.addLeqOrder(Bottom, [Unscaled, Scaled])
	.addLeqOrder(Unscaled, Top)
	.addLeqOrder(Scaled, Top)
	.build();

export const scaleAnalysis = new TaintAnalysisDefinition('scale', scaleDomain)
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
