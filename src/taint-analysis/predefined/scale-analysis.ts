import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import type { TaintCondition } from '../function-mapper';
import { Identifier } from '../../dataflow/environments/identifier';

export const MinMax = Symbol('Min-Max');
export const ZeroCentered = Symbol('Zero Centered');
export const UnitVariance = Symbol('Unit Variance');
export const ZScore = Symbol('z-Score');
export const Unscaled = Symbol('Unscaled');

type ScaleLatticeElements = [typeof MinMax, typeof ZeroCentered, typeof UnitVariance, typeof ZScore, typeof Unscaled];

export const scaleDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...ScaleLatticeElements]>()
	.addLeqOrder(Bottom, [ZScore, MinMax, Unscaled])
	.addLeqOrder(ZScore, [ZeroCentered, UnitVariance])
	.addLeqOrder(ZeroCentered, Top)
	.addLeqOrder(UnitVariance, Top)
	.addLeqOrder(MinMax, Top)
	.addLeqOrder(Unscaled, Top)
	.build();

/** Sink condition reporting the aggregate of data whose taint is one of the given elements as a known constant. */
function constantAggregate(...elements: symbol[]): TaintCondition<typeof scaleDomain> {
	return {
		argTaints: [{ pos: 0, name: 'x' }],
		condition: (_args, [taint]) => elements.includes(taint as symbol) ? Bottom : (taint ?? Top)
	};
}

export const scaleAnalysis = new TaintAnalysisDefinition('scale', scaleDomain)
	.from([
		{
			identifier: Identifier.make('scale', 'base'),
			condition:  {
				argValues: [
					{ pos: 1, name: 'center', default: true },
					{ pos: 2, name: 'scale', default: true }
				],
				argTaints: [{ pos: 0, name: 'x' }],
				condition: ([center, scale], [taint]) => {
					if(center === true && scale === true) {
						return ZScore;
					} else if(center === true) {
						return ZeroCentered;
					} else if(center === false && scale === false) {
						return taint ?? Top;
					}
					return Top;
				}
			}
		},
		{ identifier: Identifier.make('scales', 'rescale'), taint: MinMax },
	])
	.through([
		// non-linear elementwise transformations
		{
			identifier: [
				Identifier.make('abs', 'base'),

				// Logarithms
				Identifier.make('log', 'base'),
				Identifier.make('log2', 'base'),
				Identifier.make('log10', 'base'),
				Identifier.make('log1p', 'base'),

				// Exponentials
				Identifier.make('exp', 'base'),
				Identifier.make('expm1', 'base'),

				Identifier.make('sqrt', 'base'),

				// Rounding
				Identifier.make('sign', 'base'),
				Identifier.make('round', 'base'),
				Identifier.make('signif', 'base'),
				Identifier.make('floor', 'base'),
				Identifier.make('ceiling', 'base'),
				Identifier.make('trunc', 'base'),

				// Trigonometrics
				Identifier.make('sin', 'base'),
				Identifier.make('cos', 'base'),
				Identifier.make('tan', 'base'),
			],
			taint: Unscaled
		},
		// dropping elements removes our assumptions
		{
			identifier: [
				Identifier.make('subset', 'base'),
				Identifier.make('Filter', 'base'),
				Identifier.make('head', 'utils'),
				Identifier.make('tail', 'utils'),
			],
			taint: Unscaled
		}
	])
	.to([
		{ identifier: 'mean', condition: constantAggregate(ZeroCentered, ZScore) },
		{ identifier: 'sd', condition: constantAggregate(UnitVariance, ZScore) },
		{ identifier: 'var', condition: constantAggregate(UnitVariance, ZScore) },
		{ identifier: ['min', 'max', 'range'], condition: constantAggregate(MinMax) }
	])
	.report('Aggregation of scaled data yields a known constant');
