import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { PkgName  } from '../../dataflow/environments/identifier';
import type { TaintCondition } from '../taint-mapping';

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

const checkCalcOnNormalizedInput = (...checkedTaints: symbol[]): TaintCondition<typeof scaleDomain> => {
	return {
		argTaints:   [{ pos: 0, name: 'x' }],
		conditionFn: (_args, [taint]) => checkedTaints.includes(taint.value) ? Bottom : (taint.value ?? Top)
	};
};

export const scaleAnalysis = TaintAnalysisDefinition.create('scale', scaleDomain)
	.from(
		{
			identifier: ['scale', PkgName.Base],
			condition:  {
				argValues: [
					{ pos: 1, name: 'center', default: true },
					{ pos: 2, name: 'scale', default: true }
				],
				argTaints:   [{ pos: 0, name: 'x' }],
				conditionFn: ([center, scale], [taint]) => {
					if(center === true && scale === true) {
						return ZScore;
					} else if(center === true) {
						return ZeroCentered;
					} else if(center === false && scale === false) {
						return taint.value ?? Top;
					}
					return Top;
				}
			}
		},
		{ identifier: ['rescale', 'scales'], taint: MinMax },
	)
	.through(
		// non-linear elementwise transformations
		{
			identifier: [
				['abs', PkgName.Base],

				// Logarithms
				['log', PkgName.Base],
				['log2', PkgName.Base],
				['log10', PkgName.Base],
				['log1p', PkgName.Base],

				// Exponentials
				['exp', PkgName.Base],
				['expm1', PkgName.Base],

				['sqrt', PkgName.Base],

				// Rounding
				['sign', PkgName.Base],
				['signif', PkgName.Base],
				['floor', PkgName.Base],
				['ceiling', PkgName.Base],
				['trunc', PkgName.Base],

				// Trigonometrics
				['sin', PkgName.Base],
				['cos', PkgName.Base],
				['tan', PkgName.Base],
			],
			taint: Unscaled
		},
		{
			identifier: ['round', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'x' }],
				// Rounding only removes centering and variance assumption, min-max taint is kept
				conditionFn: (_args, [taint]) =>
					taint.value == ZScore || taint.value == ZeroCentered || taint.value == UnitVariance ? Unscaled : taint.value
			}
		},
		// dropping elements
		{
			identifier: [
				['subset', PkgName.Base],
				['Filter', PkgName.Base],
				['head', PkgName.Utils],
				['tail', PkgName.Utils],
			],
			taint: Top
		}
	)
	.to(
		{ identifier: 'mean', condition: checkCalcOnNormalizedInput(ZeroCentered, ZScore) },
		{ identifier: 'sd', condition: checkCalcOnNormalizedInput(UnitVariance, ZScore) },
		{ identifier: 'var', condition: checkCalcOnNormalizedInput(UnitVariance, ZScore) },
		{ identifier: ['min', 'max', 'range'], condition: checkCalcOnNormalizedInput(MinMax) }
	).report((f) => {
		return f.functionName ? `${f.functionName} calculated on normalized data [${f.locString}]` : `Known summary statistic calculated on normalized data [${f.locString}]`;
	});
