import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { AbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { Identifier, PkgName } from '../../dataflow/environments/identifier';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { ArgProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { TaintFnCategory } from '../function-categories';
import { taintMappingFromBuiltInIndex } from '../builtin-index-bridge';
import type { TaintConditionFunction } from '../taint-mapping';

export const Random = Symbol('Random');
export const Deterministic = Symbol('Deterministic');

export const randomnessDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...[typeof Random, typeof Deterministic]]>()
	.addLeqOrder(Bottom, [Random, Deterministic])
	.addLeqOrder(Random, Top)
	.addLeqOrder(Deterministic, Top)
	.build();

const randomnessSinkCondition: TaintConditionFunction<typeof randomnessDomain> =
	(_args, taints) => taints.some(taint => taint.value === Random) ? Bottom : AbstractDomain.joinAll(taints).value;

export const randomnessAnalysis = TaintAnalysisDefinition.create('randomness', randomnessDomain)
	.on(TaintFnCategory.pureComputer, ([_arg], taints) => {
		if(taints.some(t => t.value === Random)) {
			return Random;
		}
		if(taints.length > 0) {
			return AbstractDomain.joinAll(taints).value;
		}
		return Top;
	})
	.from(
		{
			identifier: [
				// vector constructor functions
				['vector', PkgName.Base],
				['numeric', PkgName.Base],
				['double', PkgName.Base],
				['integer', PkgName.Base],
				['logical', PkgName.Base],
				['complex', PkgName.Base],
				['raw', PkgName.Base],
				['character', PkgName.Base],
				['single', PkgName.Base],

				['mat.or.vec', PkgName.Base],

				// type checks
				['is.vector', PkgName.Base],
				['is.numeric', PkgName.Base],
				['is.double', PkgName.Base],
				['is.integer', PkgName.Base],
				['is.logical', PkgName.Base],
				['is.complex', PkgName.Base],
				['is.raw', PkgName.Base],
				['is.character', PkgName.Base],
				['is.single', PkgName.Base],
				['is.matrix', PkgName.Base],
				['is.factor', PkgName.Base],
				['is.ordered', PkgName.Base],

				// sequence functions
				['seq', PkgName.Base],
				['seq.Date', PkgName.Base],
				['seq.POSIXt', PkgName.Base],
				['sequence', PkgName.Base],
				['seq_along', PkgName.Base],
				['seq_len', PkgName.Base],
			],
			taint: Deterministic
		},
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.Random)]
				.filter(i => !Identifier.matches(i, ['set.seed', PkgName.Base])),
			taint: Random
		}
	)
	.through(
		{
			identifier: [
				// coercion
				['as.vector', PkgName.Base],
				['as.numeric', PkgName.Base],
				['as.double', PkgName.Base],
				['as.integer', PkgName.Base],
				['as.logical', PkgName.Base],
				['as.complex', PkgName.Base],
				['as.raw', PkgName.Base],
				['as.character', PkgName.Base],
				['as.single', PkgName.Base],
				['as.matrix', PkgName.Base],
				['as.factor', PkgName.Base],
				['as.ordered', PkgName.Base],

				// repetition
				['rep', PkgName.Base], ['rep.int', PkgName.Base], ['rep_len', PkgName.Base],

				// additional common functions
				['which', PkgName.Base]
			],
			condition: {
				argTaints:   [{ pos: 0, name: 'x' }],
				conditionFn: (_args, [taint]) => taint.value
			}
		},
	)
	.to(
		{
			identifier: ['summary', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'object' }],
				conditionFn: randomnessSinkCondition
			}
		},
		{
			identifier: ['lm', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'formula' }, { pos: 1, name: 'data' }],
				conditionFn: randomnessSinkCondition
			}
		},
		{
			identifier: ['ggplot', PkgName.GgPlot2],
			condition:  {
				argTaints:   [{ pos: 0, name: 'data' }],
				conditionFn: randomnessSinkCondition
			}
		},
		...taintMappingFromBuiltInIndex<typeof randomnessDomain>([SemanticCallTag.Writes, SemanticCallTag.Graphics], ArgProp.Value, randomnessSinkCondition)
	).to(...taintMappingFromBuiltInIndex<typeof randomnessDomain>([SemanticCallTag.Writes, SemanticCallTag.Graphics], ArgProp.Value,
		(_args, taints) => taints.some(taint => taint.value === Random) ? Bottom : AbstractDomain.joinAll(taints).value)
	).report('Non-deterministic random data is written to output (result may not be reproducible)');

