import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { PkgName  } from '../../dataflow/environments/identifier';
import type { TaintCondition, TaintMapping } from '../taint-mapping';
import { TaintFnCategory } from '../function-categories';

export const MinMax = Symbol('Min-Max');
export const ZeroCentered = Symbol('Zero Centered');
export const UnitVariance = Symbol('Unit Variance');
export const ZScore = Symbol('z-Score');

type ScaleLatticeElements = [typeof MinMax, typeof ZeroCentered, typeof UnitVariance, typeof ZScore];

export const normalizationDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...ScaleLatticeElements]>()
	.addLeqOrder(Bottom, [ZScore, MinMax])
	.addLeqOrder(ZScore, [ZeroCentered, UnitVariance])
	.addLeqOrder(ZeroCentered, Top)
	.addLeqOrder(UnitVariance, Top)
	.addLeqOrder(MinMax, Top)
	.build();

/** Yield bottom when the input carries one of the given normalization taints. */
const checkKnownConstant = (...checkedTaints: symbol[]): TaintCondition<typeof normalizationDomain> => {
	return {
		argDefinition: [{ pos: 0, name: 'x' }],
		conditionFn:   (_args, [taint]) => checkedTaints.includes(taint.value) ? Bottom : (taint.value ?? Top)
	};
};

/** Yield bottom for any concrete normalization taint. */
const checkAnyNormalized = checkKnownConstant(MinMax, ZeroCentered, UnitVariance, ZScore);

/** Functions producing a normalized value. */
const normalizationSources: TaintMapping<typeof normalizationDomain>[] = [
	{
		identifier: ['scale', PkgName.Base],
		condition:  {
			argValues: [
				{ pos: 1, name: 'center', default: true },
				{ pos: 2, name: 'scale', default: true }
			],
			argDefinition: [{ pos: 0, name: 'x' }],
			conditionFn:   ([center, scale], [taint]) => {
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
];

/** Transformations changing the normalization taint. */
const normalizationTransformers: TaintMapping<typeof normalizationDomain>[] = [
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
		taint: Top
	},
	{
		identifier: ['round', PkgName.Base],
		condition:  {
			argDefinition: [{ pos: 0, name: 'x' }],
			// Rounding only removes centering and variance assumption, min-max taint is kept
			conditionFn:   (_args, [taint]) =>
				taint.value === ZScore || taint.value === ZeroCentered || taint.value === UnitVariance ? Top : taint.value
		}
	},
	{
		identifier: [
			// dropping elements
			['subset', PkgName.Base],
			['filter', PkgName.Base],
			['head', PkgName.Utils],
			['tail', PkgName.Utils],

			// additional common functions
			['rep', PkgName.Base], ['rep.int', PkgName.Base], ['rep_len', PkgName.Base], ['which', PkgName.Base]
		],
		taint: Top
	},
];

/**
 * Detects summary statistics whose result is a statically known constant because the input carries a specific
 * normalization taint (e.g. the mean of zero-centered data is 0, the sd of unit-variance data is 1).
 */
export const normalizationKnownConstant = TaintAnalysisDefinition.create('normalization-constant', normalizationDomain)
	.on(TaintFnCategory.pureAlias)
	// assumption: calculation on input data will usually destroy normalization
	.on(TaintFnCategory.pureComputer, (_args, _taints) => Top)
	.on(TaintFnCategory.pureShape, (_args, _taints) => Top)
	.from(...normalizationSources)
	.through(...normalizationTransformers)
	.to(
		{ identifier: ['mean', PkgName.Base], condition: checkKnownConstant(ZeroCentered, ZScore) },
		{ identifier: ['sd', PkgName.Stats], condition: checkKnownConstant(UnitVariance, ZScore) },
		{ identifier: ['var', PkgName.Stats], condition: checkKnownConstant(UnitVariance, ZScore) },
		{ identifier: [['min', PkgName.Base], ['max', PkgName.Base], ['range', PkgName.Base]], condition: checkKnownConstant(MinMax) }
	).report((f) => {
		return f.functionName ? `${f.functionName} calculated on normalized data yields a known result [${f.locString}]` : `Known summary statistic calculated on normalized data [${f.locString}]`;
	});

/**
 * Detects any normalized value reaching any summary statistic, regardless of which normalization was applied
 * or whether the result is a statically known constant.
 */
export const normalizationReach = TaintAnalysisDefinition.create('normalization-reach', normalizationDomain)
	.on(TaintFnCategory.pureAlias)
	// assumption: calculation on input data will usually destroy normalization
	.on(TaintFnCategory.pureComputer, (_args, _taints) => Top)
	.on(TaintFnCategory.pureShape, (_args, _taints) => Top)
	.from(...normalizationSources)
	.through(...normalizationTransformers)
	.to(
		{
			identifier: [
				['mean', PkgName.Base],
				['sum', PkgName.Base],
				['median', PkgName.Stats],
				['quantile', PkgName.Stats],
				['range', PkgName.Base],
				['min', PkgName.Base],
				['max', PkgName.Base],
				['sd', PkgName.Stats],
				['var', PkgName.Stats],
				['IQR', PkgName.Stats],
				['fivenum', PkgName.Stats],
				['colMeans', PkgName.Base],
				['rowMeans', PkgName.Base],
				['colSums', PkgName.Base],
				['rowSums', PkgName.Base],
			],
			condition: checkAnyNormalized
		}
	).report((f) => {
		return f.functionName ? `${f.functionName} calculated on normalized data [${f.locString}]` : `Summary statistic calculated on normalized data [${f.locString}]`;
	});
