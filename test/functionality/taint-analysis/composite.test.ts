import { describe, test } from 'vitest';
import { testCompositeTaintAnalysis } from './helper';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { scaleAnalysis, Unscaled, ZScore } from '../../../src/taint-analysis/predefined/scale-analysis';
import { Deterministic, randomnessAnalysis } from '../../../src/taint-analysis/predefined/randomness-analysis';
import type { TaintProduct } from '../../../src/taint-analysis/composite-taint-visitor';
import type { ProductReduction } from '../../../src/abstract-interpretation/domains/partial-product-domain';

describe('Composite Taint Analysis', () => {
	describe('direct product of two custom analyses', () => {
		const TagA = Symbol('A');
		const TagB = Symbol('B');

		const domainA = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, typeof TagA]>()
			.addLeqOrder(Bottom, TagA)
			.addLeqOrder(TagA, Top)
			.build();
		const domainB = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, typeof TagB]>()
			.addLeqOrder(Bottom, TagB)
			.addLeqOrder(TagB, Top)
			.build();

		const alpha = new TaintAnalysisDefinition('alpha', domainA)
			.through([{ identifier: Identifier.make('c'), taint: TagA }]);
		const beta = new TaintAnalysisDefinition('beta', domainB)
			.through([{ identifier: Identifier.make('list'), taint: TagB }]);

		const composed = TaintAnalysisDefinition.compose('alpha-x-beta', [alpha, beta]);

		test('each component only tags its own source, the other is Top', async() => {
			await testCompositeTaintAnalysis(`
				x <- c(1, 2, 3)
				y <- list(1, 2, 3)`,
			composed,
			{
				'1@x': { alpha: TagA, beta: Top },
				'2@y': { alpha: Top, beta: TagB },
			});
		});
	});

	describe('direct product of predefined scale and randomness analyses', () => {
		const composed = TaintAnalysisDefinition.compose('scale-x-randomness', [scaleAnalysis, randomnessAnalysis]);

		test('combines the per-node taint of both analyses', async() => {
			await testCompositeTaintAnalysis(`
				x <- c(1, 2, 3, 4, 5)
				x <- scale(x)`,
			composed,
			{
				'1@x': { scale: Unscaled, randomness: Deterministic },
				'2@x': { scale: ZScore, randomness: Top },
			});
		});
	});

	describe('reduced product of predefined scale and randomness analyses', () => {
		// reduction: once a value is z-score scaled, treat the randomness component as Bottom (a contrived interaction)
		const collapseRandomnessOnZScore: ProductReduction<TaintProduct> = value => {
			if(value['scale']?.value === ZScore && value['randomness'] !== undefined) {
				return { ...value, randomness: value['randomness'].bottom() };
			}
			return value;
		};

		const composed = TaintAnalysisDefinition.compose('scale-x-randomness-reduced', [scaleAnalysis, randomnessAnalysis], {
			reductions: [collapseRandomnessOnZScore]
		});

		test('the reduction refines the randomness component based on the scale component', async() => {
			await testCompositeTaintAnalysis(`
				x <- c(1, 2, 3, 4, 5)
				x <- scale(x)`,
			composed,
			{
				'1@x': { scale: Unscaled, randomness: Deterministic },
				'2@x': { scale: ZScore, randomness: Bottom },
			});
		});
	});
});
