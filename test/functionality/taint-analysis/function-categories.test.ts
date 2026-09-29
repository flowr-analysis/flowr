import { assert, describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { TaintFnCategory } from '../../../src/taint-analysis/function-categories';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis, testTaintAnalyses } from './helper';
import { decorateLabelContext, label } from '../_helper/label';

function testCategory(
	name: string,
	code: string,
	expectation: TaintAnalysisExpectation,
	analysis: TaintAnalysisDefinition
): void {
	test(decorateLabelContext(label(name), ['taint']), async() => {
		await testTaintAnalysis(code, analysis, expectation);
	});
}

const Tainted = Symbol('Tainted');

const lattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, Tainted)
	.addLeqOrder(Tainted, Top)
	.build();

const source = { identifier: Identifier.make('taint'), taint: Tainted };

const Src = Symbol('Src');
const TaintA = Symbol('TaintA');
const TaintB = Symbol('TaintB');

const reclassLattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [Src, TaintA, TaintB])
	.addLeqOrder(Src, Top)
	.addLeqOrder(TaintA, Top)
	.addLeqOrder(TaintB, Top)
	.build();

const PrecedenceSource = Symbol('PrecedenceSource');
const Explicit = Symbol('Explicit');
const DefinitionCategory = Symbol('DefinitionCategory');
const AnalysisCategory = Symbol('AnalysisCategory');

const precedenceLattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [PrecedenceSource, Explicit, DefinitionCategory, AnalysisCategory])
	.addLeqOrder(PrecedenceSource, Top)
	.addLeqOrder(Explicit, Top)
	.addLeqOrder(DefinitionCategory, Top)
	.addLeqOrder(AnalysisCategory, Top)
	.build();

const precedenceSource = { identifier: Identifier.make('taint'), taint: PrecedenceSource };

describe('Taint Function Categories', () => {
	describe('Pure Aliasing Functions (pureAlias)', () => {
		const aliasAnalysis = TaintAnalysisDefinition.create('pure-alias', lattice)
			.on(TaintFnCategory.pureAlias)
			.from(source).getPartialDefinition();

		testCategory('identity forwards the taint of its argument', 'x <- identity(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('force forwards the taint of its argument', 'x <- force(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('invisible forwards the taint of its argument', 'x <- invisible(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('taint passes through a chain of aliasing calls', 'x <- taint()\ny <- identity(force(x))', { '2@y': Tainted }, aliasAnalysis);
		testCategory('a computing function is outside this category, so its result is Top', 'x <- abs(taint())', { '1@x': Top }, aliasAnalysis);
	});

	describe('Pure Computing Functions (pureComputer)', () => {
		const computerAnalysis = TaintAnalysisDefinition.create('pure-computer', lattice)
			.on(TaintFnCategory.pureComputer)
			.from(source).getPartialDefinition();

		testCategory('abs forwards the taint of its argument', 'x <- abs(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('sqrt forwards the taint of its argument', 'x <- sqrt(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('tolower forwards the taint of its argument', 'x <- tolower(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('taint passes through a pipe chain of computing calls', 'y <- taint() |> abs() |> sqrt()', { '1@y': Tainted }, computerAnalysis);
		testCategory('an aliasing function is outside this category, so it breaks the chain to Top', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '2@y': Top, '3@z': Top }, computerAnalysis);
	});

	describe('Combined Categories', () => {
		const combinedAnalysis = TaintAnalysisDefinition.create('pure-both', lattice)
			.on(TaintFnCategory.pureAlias)
			.on(TaintFnCategory.pureComputer)
			.from(source).getPartialDefinition();

		testCategory('an aliasing call wrapping a computing call forwards the taint', 'x <- identity(abs(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('a computing call wrapping an aliasing call forwards the taint', 'x <- sqrt(force(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('an unmapped, non-built-in function still yields Top', 'x <- unmappedFn(taint())', { '1@x': Top }, combinedAnalysis);
	});

	describe('Custom Handler', () => {
		const reclassAnalysis = TaintAnalysisDefinition.create('reclassify', reclassLattice)
			.on(TaintFnCategory.pureAlias, () => TaintA)
			.on(TaintFnCategory.pureComputer, () => TaintB)
			.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();

		testCategory('the raw source keeps its own taint', 'x <- taint()', { '1@x': Src }, reclassAnalysis);
		testCategory('going through an aliasing function maps to TaintA', 'x <- identity(taint())', { '1@x': TaintA }, reclassAnalysis);
		testCategory('going through a computing function maps to TaintB', 'x <- abs(taint())', { '1@x': TaintB }, reclassAnalysis);
		testCategory('each aliasing function in the category reclassifies to TaintA', 'x <- force(taint())', { '1@x': TaintA }, reclassAnalysis);
		testCategory('each computing function in the category reclassifies to TaintB', 'x <- sqrt(taint())', { '1@x': TaintB }, reclassAnalysis);
		testCategory('every hop reclassifies to the taint of the category it passes through', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '1@x': Src, '2@y': TaintA, '3@z': TaintB }, reclassAnalysis);
		testCategory('the custom handler overrides the incoming taint regardless of order', 'x <- abs(identity(taint()))', { '1@x': TaintB }, reclassAnalysis);
	});

	describe('Custom Handler Evaluating the Incoming Taint', () => {
		const evalAnalysis = TaintAnalysisDefinition.create('reclassify-eval', reclassLattice)
			.on(TaintFnCategory.pureAlias, (_args, [incoming]) => incoming.value === Src ? TaintA : incoming.value)
			.on(TaintFnCategory.pureComputer, (_args, [incoming]) => incoming.value === TaintA ? Top : incoming.value)
			.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();

		testCategory('the aliasing handler relabels the raw source to TaintA', 'x <- identity(taint())', { '1@x': TaintA }, evalAnalysis);
		testCategory('the aliasing handler leaves an already-classified taint untouched', 'x <- taint()\ny <- identity(x)\nz <- identity(y)', { '2@y': TaintA, '3@z': TaintA }, evalAnalysis);
		testCategory('the computing handler passes a non-A taint through unchanged', 'x <- abs(taint())', { '1@x': Src }, evalAnalysis);
		testCategory('the computing handler escalates a TaintA argument to Top', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '2@y': TaintA, '3@z': Top }, evalAnalysis);
		testCategory('repeated computing calls keep passing the unescalated source through', 'x <- abs(abs(taint()))', { '1@x': Src }, evalAnalysis);
	});

	describe('Pure Computing Functions over Multiple Arguments (least upper bound)', () => {
		const Low = Symbol('Low');
		const High = Symbol('High');

		const orderedLattice = new FiniteDomainBuilder()
			.addLeqOrder(Bottom, Low)
			.addLeqOrder(Low, High)
			.addLeqOrder(High, Top)
			.build();

		const lubOrderedAnalysis = TaintAnalysisDefinition.create('lub-ordered', orderedLattice)
			.on(TaintFnCategory.pureComputer)
			.from(
				{ identifier: Identifier.make('taintLow'), taint: Low },
				{ identifier: Identifier.make('taintHigh'), taint: High },
			).getPartialDefinition();

		const lubIncomparableAnalysis = TaintAnalysisDefinition.create('lub-incomparable', reclassLattice)
			.on(TaintFnCategory.pureComputer)
			.from(
				{ identifier: Identifier.make('taintA'), taint: TaintA },
				{ identifier: Identifier.make('taintB'), taint: TaintB },
			).getPartialDefinition();

		testCategory('the least upper bound of two equal argument taints is that taint', 'x <- atan2(taintLow(), taintLow())', { '1@x': Low }, lubOrderedAnalysis);
		testCategory('the least upper bound of two comparable taints is the greater one', 'x <- atan2(taintLow(), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound is independent of the argument order', 'x <- atan2(taintHigh(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound is taken over more than two arguments', 'x <- paste(taintLow(), taintHigh(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('an untainted co-argument raises the result to Top', 'x <- atan2(taintHigh(), 1)', { '1@x': Top }, lubOrderedAnalysis);
		testCategory('the least upper bound composes through nested computing calls', 'x <- atan2(atan2(taintLow(), taintLow()), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound of two incomparable taints is their join', 'x <- atan2(taintA(), taintB())', { '1@x': Top }, lubIncomparableAnalysis);

		describe('a variadic parameter alongside fixed parameters', () => {
			testCategory('without fixed parameter only variadic args are joined',
				'x <- paste(taintLow(), taintLow(), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
			testCategory('a fixed Value parameter behind variadic args is joined',
				'x <- paste(taintLow(), taintLow(), sep = taintHigh())', { '1@x': High }, lubOrderedAnalysis);

			testCategory('a fixed parameter before variadic args is joined',
				'x <- sprintf(taintHigh(), taintLow(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
			testCategory('a variadic arg past the fixed parameter is joined',
				'x <- sprintf(taintLow(), taintLow(), taintHigh())', { '1@x': High }, lubOrderedAnalysis);

			testCategory('leading fixed parameters are joined with the trailing variadic args',
				'x <- sort(taintHigh(), taintLow(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
			testCategory('a variadic arg after fixed parameters are joined',
				'x <- sort(taintLow(), taintLow(), taintLow(), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
			testCategory('only parameters with relevant argument properties are included in join',
				'x <- sort(taintLow(), taintHigh(), taintLow())', { '1@x': Low }, lubOrderedAnalysis);
		});
	});

	describe('Operators as Propagators', () => {
		const computerAnalysis = TaintAnalysisDefinition.create('binop-computer', lattice)
			.on(TaintFnCategory.pureComputer)
			.from(source).getPartialDefinition();

		describe('arithmetic and comparison operators forward taint (pureComputer)', () => {
			for(const op of ['+', '-', '*', '/', '^', ':', '==', '!=', '>', '<', '>=', '<=']) {
				testCategory(`operator ${op} forwards the taint of its operands`,
					`x <- taint() ${op} taint()`, { '1@x': Tainted }, computerAnalysis);
			}
		});

		testCategory('an untainted operand raises the result to Top',
			'x <- taint() + 1', { '1@x': Top }, computerAnalysis);
		testCategory('taint propagates through a chain of binary operators',
			'x <- taint() + taint() * taint()', { '1@x': Tainted }, computerAnalysis);
		testCategory('a repeated variable operand forwards its taint',
			'y <- taint()\nx <- y - y', { '2@x': Tainted }, computerAnalysis);
		testCategory('the taint of a binary operator result flows into a subsequent call',
			'y <- taint() + taint()\nx <- abs(y)', { '2@x': Tainted }, computerAnalysis);
		testCategory('a binary operator wrapping computing calls forwards the taint',
			'x <- abs(taint()) * sqrt(taint())', { '1@x': Tainted }, computerAnalysis);

		describe('unary operators forward taint (pureComputer)', () => {
			testCategory('unary minus forwards the taint of its operand',
				'x <- -taint()', { '1@x': Tainted }, computerAnalysis);
			testCategory('unary plus forwards the taint of its operand',
				'x <- +taint()', { '1@x': Tainted }, computerAnalysis);
			testCategory('logical negation forwards the taint of its operand',
				'x <- !taint()', { '1@x': Tainted }, computerAnalysis);
			testCategory('nested unary operators forward the taint',
				'x <- -(-taint())', { '1@x': Tainted }, computerAnalysis);
			testCategory('a unary operator over an untainted operand is Top',
				'x <- -1', { '1@x': Top }, computerAnalysis);
		});

		describe('a binary operator is not an aliasing function', () => {
			const aliasAnalysis = TaintAnalysisDefinition.create('binop-alias', lattice)
				.on(TaintFnCategory.pureAlias)
				.from(source).getPartialDefinition();

			testCategory('under pureAlias alone a binary operator is unmapped, so its result is Top',
				'x <- taint() + taint()', { '1@x': Top }, aliasAnalysis);
		});

		describe('an unmapped binary operator resolves to Top', () => {
			const sourceOnly = TaintAnalysisDefinition.create('binop-source-only', lattice)
				.from(source).getPartialDefinition();

			testCategory('with no category and no explicit rule, a binary operator is Top',
				'x <- taint() + taint()', { '1@x': Top }, sourceOnly);
		});

		describe('custom handler reclassifies a binary operator result', () => {
			const reclassAnalysis = TaintAnalysisDefinition.create('binop-reclass', reclassLattice)
				.on(TaintFnCategory.pureComputer, () => TaintB)
				.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();

			testCategory('the pureComputer handler relabels the operator result',
				'x <- taint() + taint()', { '1@x': TaintB }, reclassAnalysis);
		});

		describe('least upper bound over operand taints', () => {
			const Low = Symbol('Low');
			const High = Symbol('High');
			const orderedLattice = new FiniteDomainBuilder()
				.addLeqOrder(Bottom, Low)
				.addLeqOrder(Low, High)
				.addLeqOrder(High, Top)
				.build();
			const lubAnalysis = TaintAnalysisDefinition.create('binop-lub', orderedLattice)
				.on(TaintFnCategory.pureComputer)
				.from(
					{ identifier: Identifier.make('taintLow'), taint: Low },
					{ identifier: Identifier.make('taintHigh'), taint: High },
				).getPartialDefinition();

			testCategory('the operator result is the least upper bound of its operand taints',
				'x <- taintLow() + taintHigh()', { '1@x': High }, lubAnalysis);
			testCategory('the least upper bound is independent of operand order',
				'x <- taintHigh() * taintLow()', { '1@x': High }, lubAnalysis);
		});

		describe('an operator can be mapped explicitly by its name', () => {
			const explicitAnalysis = TaintAnalysisDefinition.create('binop-explicit', lattice)
				.from()
				.through({ identifier: Identifier.make('+'), taint: Tainted })
				.getPartialDefinition();

			testCategory('the explicitly mapped operator gets its fixed taint regardless of operands',
				'x <- 1 + 2', { '1@x': Tainted }, explicitAnalysis);
			testCategory('a different, unmapped operator is unaffected and stays Top',
				'x <- 1 - 2', { '1@x': Top }, explicitAnalysis);
		});
	});

	describe('Analysis-Level Categories (TaintAnalysis.on)', () => {
		test('a category declared on the shared TaintAnalysis builder is used by every analysis added to it', async() => {
			const analysisA = TaintAnalysisDefinition.create('shared-alias-a', lattice).from(source).getPartialDefinition();
			const analysisB = TaintAnalysisDefinition.create('shared-alias-b', lattice).from(source).getPartialDefinition();

			await testTaintAnalyses('x <- identity(taint())', new Set([
				['shared-alias-a', analysisA, { '1@x': Tainted }],
				['shared-alias-b', analysisB, { '1@x': Tainted }],
			]), undefined, builder => builder.on(TaintFnCategory.pureAlias));
		});

		test('multiple categories declared on the shared builder combine for every analysis added to it', async() => {
			const analysisA = TaintAnalysisDefinition.create('shared-combined-a', lattice).from(source).getPartialDefinition();
			const analysisB = TaintAnalysisDefinition.create('shared-combined-b', lattice).from(source).getPartialDefinition();

			await testTaintAnalyses('x <- identity(abs(taint()))', new Set([
				['shared-combined-a', analysisA, { '1@x': Tainted }],
				['shared-combined-b', analysisB, { '1@x': Tainted }],
			]), undefined, builder => builder.on(TaintFnCategory.pureAlias).on(TaintFnCategory.pureComputer));
		});

		test('categories declared on one TaintAnalysis do not persist into a separately created TaintAnalysis', async() => {
			const code = 'x <- identity(taint())';

			const withCategory = TaintAnalysisDefinition.create('isolated-with-category', lattice).from(source).getPartialDefinition();
			await testTaintAnalyses(code, new Set([
				['isolated-with-category', withCategory, { '1@x': Tainted }],
			]), undefined, builder => builder.on(TaintFnCategory.pureAlias));

			const withoutCategory = TaintAnalysisDefinition.create('isolated-without-category', lattice).from(source).getPartialDefinition();
			await testTaintAnalyses(code, new Set([
				['isolated-without-category', withoutCategory, { '1@x': Top }],
			]));
		});

		describe('Custom Handler on the Shared Builder', () => {
			test('a custom handler passed directly to .on() overrides the category default for every analysis added to it', async() => {
				const analysisA = TaintAnalysisDefinition.create('shared-handler-a', reclassLattice)
					.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();
				const analysisB = TaintAnalysisDefinition.create('shared-handler-b', reclassLattice)
					.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();

				await testTaintAnalyses('x <- identity(taint())', new Set([
					['shared-handler-a', analysisA, { '1@x': TaintA }],
					['shared-handler-b', analysisB, { '1@x': TaintA }],
				]), undefined, builder => builder.on(TaintFnCategory.pureAlias, () => TaintA));
			});

			test('a custom handler passed directly to .on() can evaluate the incoming taint', async() => {
				const analysisA = TaintAnalysisDefinition.create('shared-handler-eval-a', reclassLattice)
					.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();
				const analysisB = TaintAnalysisDefinition.create('shared-handler-eval-b', reclassLattice)
					.from({ identifier: Identifier.make('taint'), taint: TaintB }).getPartialDefinition();

				await testTaintAnalyses('x <- taint()\ny <- identity(x)\nz <- abs(y)\nw <- identity(z)', new Set([
					['shared-handler-eval-a', analysisA, { '1@x': Src, '2@y': TaintA, '3@z': TaintA, '4@w': TaintA }],
					['shared-handler-eval-b', analysisB, { '1@x': TaintB, '2@y': TaintB, '3@z': Top, '4@w': Top }],
				]), undefined, builder => builder
					.on(TaintFnCategory.pureAlias, (_args, [incoming]) => incoming.value === Src ? TaintA : incoming.value)
					.on(TaintFnCategory.pureComputer, (_args, [incoming]) => incoming.value === TaintB ? Top : incoming.value));
			});
		});

		describe('Mapping Precedence (explicit rule > definition-level category > analysis-level category)', () => {
			test('an explicit rule on the analysis takes precedence over both a definition-level and an analysis-level category mapping', async() => {
				const analysis = TaintAnalysisDefinition.create('precedence-explicit', precedenceLattice)
					.on(TaintFnCategory.pureAlias, () => DefinitionCategory)
					.from()
					.through({ identifier: Identifier.make('identity'), taint: Explicit })
					.getPartialDefinition();

				await testTaintAnalyses('x <- identity(taint())', new Set([
					['precedence-explicit', analysis, { '1@x': Explicit }],
				]), undefined, builder => builder.on(TaintFnCategory.pureAlias, () => AnalysisCategory));
			});

			test('a definition-level category mapping takes precedence over an analysis-level category mapping when no explicit rule matches', async() => {
				const analysis = TaintAnalysisDefinition.create('precedence-definition-category', precedenceLattice)
					.on(TaintFnCategory.pureAlias, () => DefinitionCategory)
					.from(precedenceSource).getPartialDefinition();

				await testTaintAnalyses('x <- identity(taint())', new Set([
					['precedence-definition-category', analysis, { '1@x': DefinitionCategory }],
				]), undefined, builder => builder.on(TaintFnCategory.pureAlias, () => AnalysisCategory));
			});

			test('an analysis-level category mapping applies when neither an explicit rule nor a definition-level category mapping matches', async() => {
				const analysis = TaintAnalysisDefinition.create('precedence-analysis-category', precedenceLattice)
					.from(precedenceSource).getPartialDefinition();

				await testTaintAnalyses('x <- identity(taint())', new Set([
					['precedence-analysis-category', analysis, { '1@x': AnalysisCategory }],
				]), undefined, builder => builder.on(TaintFnCategory.pureAlias, () => AnalysisCategory));
			});
		});
	});

	describe('Category Handler Isolation', () => {
		test('a custom handler passed to TaintAnalysisDefinition.on() does not overwrite the default handler', async() => {
			const originalHandler = TaintFnCategory.pureAlias.handler;
			assert.isDefined(originalHandler, 'Expected pureAlias to have a default handler');

			const definitionOverride = TaintAnalysisDefinition.create('isolation-definition-override', reclassLattice)
				.on(TaintFnCategory.pureAlias, () => TaintA)
				.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();
			await testTaintAnalysis('x <- identity(taint())', definitionOverride, { '1@x': TaintA });
			assert.strictEqual(TaintFnCategory.pureAlias.handler, originalHandler);
		});

		test('a custom handler passed to TaintAnalysis.on() does not overwrite the default handler', async() => {
			const originalHandler = TaintFnCategory.pureAlias.handler;
			assert.isDefined(originalHandler, 'Expected pureAlias to have a default handler');

			const analysisOverride = TaintAnalysisDefinition.create('isolation-analysis-override', reclassLattice)
				.from({ identifier: Identifier.make('taint'), taint: Src }).getPartialDefinition();
			await testTaintAnalyses('x <- identity(taint())', new Set([
				['isolation-analysis-override', analysisOverride, { '1@x': TaintB }],
			]), undefined, builder => builder.on(TaintFnCategory.pureAlias, () => TaintB));
			assert.strictEqual(TaintFnCategory.pureAlias.handler, originalHandler);
		});
	});
});
