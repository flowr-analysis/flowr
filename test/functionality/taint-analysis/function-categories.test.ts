import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { TaintFnCategory } from '../../../src/taint-analysis/function-categories';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';
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

describe('Taint Function Categories', () => {
	describe('Pure Aliasing Functions (pureAlias)', () => {
		const aliasAnalysis = TaintAnalysisDefinition.create('pure-alias', lattice)
			.on(TaintFnCategory.pureAlias)
			.from([source]).through([]).to([]).report('');

		testCategory('identity forwards the taint of its argument', 'x <- identity(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('force forwards the taint of its argument', 'x <- force(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('invisible forwards the taint of its argument', 'x <- invisible(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('taint passes through a chain of aliasing calls', 'x <- taint()\ny <- identity(force(x))', { '2@y': Tainted }, aliasAnalysis);
		testCategory('a computing function is outside this category, so its result is Top', 'x <- abs(taint())', { '1@x': Top }, aliasAnalysis);
	});

	describe('Pure Computing Functions (pureComputer)', () => {
		const computerAnalysis = TaintAnalysisDefinition.create('pure-computer', lattice)
			.on(TaintFnCategory.pureComputer)
			.from([source]).through([]).to([]).report('');

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
			.from([source]).through([]).to([]).report('');

		testCategory('an aliasing call wrapping a computing call forwards the taint', 'x <- identity(abs(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('a computing call wrapping an aliasing call forwards the taint', 'x <- sqrt(force(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('an unmapped, non-built-in function still yields Top', 'x <- unmappedFn(taint())', { '1@x': Top }, combinedAnalysis);
	});

	describe('Custom Handler', () => {
		const reclassAnalysis = TaintAnalysisDefinition.create('reclassify', reclassLattice)
			.on(TaintFnCategory.pureAlias, () => TaintA)
			.on(TaintFnCategory.pureComputer, () => TaintB)
			.from([{ identifier: Identifier.make('taint'), taint: Src }]).through([]).to([]).report('');

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
			.from([{ identifier: Identifier.make('taint'), taint: Src }]).through([]).to([]).report('');

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
			.from([
				{ identifier: Identifier.make('taintLow'), taint: Low },
				{ identifier: Identifier.make('taintHigh'), taint: High },
			]).through([]).to([]).report('');

		const lubIncomparableAnalysis = TaintAnalysisDefinition.create('lub-incomparable', reclassLattice)
			.on(TaintFnCategory.pureComputer)
			.from([
				{ identifier: Identifier.make('taintA'), taint: TaintA },
				{ identifier: Identifier.make('taintB'), taint: TaintB },
			]).through([]).to([]).report('');

		testCategory('the least upper bound of two equal argument taints is that taint', 'x <- atan2(taintLow(), taintLow())', { '1@x': Low }, lubOrderedAnalysis);
		testCategory('the least upper bound of two comparable taints is the greater one', 'x <- atan2(taintLow(), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound is independent of the argument order', 'x <- atan2(taintHigh(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound is taken over more than two arguments', 'x <- paste(taintLow(), taintHigh(), taintLow())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('an untainted co-argument raises the result to Top', 'x <- atan2(taintHigh(), 1)', { '1@x': Top }, lubOrderedAnalysis);
		testCategory('the least upper bound composes through nested computing calls', 'x <- atan2(atan2(taintLow(), taintLow()), taintHigh())', { '1@x': High }, lubOrderedAnalysis);
		testCategory('the least upper bound of two incomparable taints is their join', 'x <- atan2(taintA(), taintB())', { '1@x': Top }, lubIncomparableAnalysis);
	});
});
