import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { Identifier } from '../../dataflow/environments/identifier';

export const MinMax = Symbol('Min-Max');
export const ZeroCentered = Symbol('Zero Centered');
export const UnitVariance = Symbol('Unit Variance');
export const ZScore = Symbol('z-Score');
export const Unscaled = Symbol('Unscaled');

export const scaleDomain = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [MinMax, ZeroCentered, UnitVariance, Unscaled])
	.addLeqOrder(ZeroCentered, ZScore)
	.addLeqOrder(UnitVariance, ZScore)
	.addLeqOrder(MinMax, Top)
	.addLeqOrder(Unscaled, Top)
	.addLeqOrder(ZScore, Top)
	.build();

export const scaleAnalysis = new TaintAnalysisDefinition('scale', scaleDomain)
	.through([ {
		identifier: Identifier.make('c'),
		taint:      Unscaled
	},
	{
		identifier: Identifier.make('scale'),
		condition:  {
			argValues: [
				{ pos: 1, name: 'center', default: true },
				{ pos: 2, name: 'scale', default: true }
			],
			argTaints: [{ pos: 0, name: 'x' }],
			condition: ([center, scale], [taint]) =>
				center && scale ? ZScore :
					center ? ZeroCentered :
						scale ? UnitVariance :
							taint
		}
	}])
	.to([{
		identifier: Identifier.make('mean'),
		condition:  {
			argTaints: [{ pos: 0, name: 'x' }],
			condition: (_args, [taint]) => {
				return (taint === ZeroCentered || taint === ZScore) ? Bottom : taint;
			}
		}
	}])
	.report('Warning: Mean of scaled value is always zero');
