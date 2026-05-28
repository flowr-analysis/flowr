import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { Identifier } from '../../dataflow/environments/identifier';

export const Unscaled = Symbol('Unscaled');
export const Scaled = Symbol('Scaled');

export const scaleDomain = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [Unscaled, Scaled])
	.addLeqOrder(Unscaled, Top)
	.addLeqOrder(Scaled, Top)
	.build();

export const scaleAnalysis = new TaintAnalysisDefinition('scale', scaleDomain)
	.through([ {
		identifier: Identifier.make('c'),
		taint:      Unscaled
	},
	{
		identifier: Identifier.make('scale'),
		taint:      Scaled,
	}
	])
	.to([{
		identifier: Identifier.make('mean'),
		condition:  {
			pos:  0,
			cond: (taint): symbol => taint == Scaled ? Bottom : taint
		}
	}])
	.report('Warning: Mean of scaled value is always zero');
