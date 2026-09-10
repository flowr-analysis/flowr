import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { TaintFnCategory } from '../../../src/taint-analysis/function-categories';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';
import { decorateLabelContext, label } from '../_helper/label';

const Tainted = Symbol('Tainted');

const lattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, Tainted)
	.addLeqOrder(Tainted, Top)
	.build();

const source = { identifier: Identifier.make('taint'), taint: Tainted };

const aliasAnalysis = TaintAnalysisDefinition.create('pure-alias', lattice)
	.on(TaintFnCategory.pureAlias)
	.from([source]).through([]).to([]).report('');

const computerAnalysis = TaintAnalysisDefinition.create('pure-computer', lattice)
	.on(TaintFnCategory.pureComputer)
	.from([source]).through([]).to([]).report('');

const combinedAnalysis = TaintAnalysisDefinition.create('pure-both', lattice)
	.on(TaintFnCategory.pureAlias)
	.on(TaintFnCategory.pureComputer)
	.from([source]).through([]).to([]).report('');

const Src = Symbol('Src');
const TaintA = Symbol('TaintA');
const TaintB = Symbol('TaintB');

const reclassLattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [Src, TaintA, TaintB])
	.addLeqOrder(Src, Top)
	.addLeqOrder(TaintA, Top)
	.addLeqOrder(TaintB, Top)
	.build();

// Custom handlers reclassify per category: aliasing calls become TaintA, computing calls become TaintB,
// regardless of the incoming taint of their argument.
const reclassAnalysis = TaintAnalysisDefinition.create('reclassify', reclassLattice)
	.on(TaintFnCategory.pureAlias, () => TaintA)
	.on(TaintFnCategory.pureComputer, () => TaintB)
	.from([{ identifier: Identifier.make('taint'), taint: Src }]).through([]).to([]).report('');

// Custom handlers that evaluate the incoming taint: aliasing calls relabel the raw source to TaintA but leave
// any already-classified taint untouched, while computing calls escalate a TaintA argument to Top.
const evalAnalysis = TaintAnalysisDefinition.create('reclassify-eval', reclassLattice)
	.on(TaintFnCategory.pureAlias, (_args, [incoming]) => incoming.value === Src ? TaintA : incoming.value)
	.on(TaintFnCategory.pureComputer, (_args, [incoming]) => incoming.value === TaintA ? Top : incoming.value)
	.from([{ identifier: Identifier.make('taint'), taint: Src }]).through([]).to([]).report('');

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

describe('Taint Function Categories', () => {
	describe('Pure Aliasing Functions (pureAlias)', () => {
		testCategory('identity forwards the taint of its argument', 'x <- identity(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('force forwards the taint of its argument', 'x <- force(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('invisible forwards the taint of its argument', 'x <- invisible(taint())', { '1@x': Tainted }, aliasAnalysis);
		testCategory('taint passes through a chain of aliasing calls', 'x <- taint()\ny <- identity(force(x))', { '2@y': Tainted }, aliasAnalysis);
		testCategory('a computing function is outside this category, so its result is Top', 'x <- abs(taint())', { '1@x': Top }, aliasAnalysis);
	});

	describe('Pure Computing Functions (pureComputer)', () => {
		testCategory('abs forwards the taint of its argument', 'x <- abs(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('sqrt forwards the taint of its argument', 'x <- sqrt(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('tolower forwards the taint of its argument', 'x <- tolower(taint())', { '1@x': Tainted }, computerAnalysis);
		testCategory('taint passes through a pipe chain of computing calls', 'y <- taint() |> abs() |> sqrt()', { '1@y': Tainted }, computerAnalysis);
		testCategory('an aliasing function is outside this category, so it breaks the chain to Top', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '2@y': Top, '3@z': Top }, computerAnalysis);
	});

	describe('Combined Categories', () => {
		testCategory('an aliasing call wrapping a computing call forwards the taint', 'x <- identity(abs(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('a computing call wrapping an aliasing call forwards the taint', 'x <- sqrt(force(taint()))', { '1@x': Tainted }, combinedAnalysis);
		testCategory('an unmapped, non-built-in function still yields Top', 'x <- unmappedFn(taint())', { '1@x': Top }, combinedAnalysis);
	});

	describe('Custom Handler', () => {
		testCategory('the raw source keeps its own taint', 'x <- taint()', { '1@x': Src }, reclassAnalysis);
		testCategory('going through an aliasing function maps to TaintA', 'x <- identity(taint())', { '1@x': TaintA }, reclassAnalysis);
		testCategory('going through a computing function maps to TaintB', 'x <- abs(taint())', { '1@x': TaintB }, reclassAnalysis);
		testCategory('each aliasing function in the category reclassifies to TaintA', 'x <- force(taint())', { '1@x': TaintA }, reclassAnalysis);
		testCategory('each computing function in the category reclassifies to TaintB', 'x <- sqrt(taint())', { '1@x': TaintB }, reclassAnalysis);
		testCategory('every hop reclassifies to the taint of the category it passes through', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '1@x': Src, '2@y': TaintA, '3@z': TaintB }, reclassAnalysis);
		testCategory('the custom handler overrides the incoming taint regardless of order', 'x <- abs(identity(taint()))', { '1@x': TaintB }, reclassAnalysis);
	});

	describe('Custom Handler Evaluating the Incoming Taint', () => {
		testCategory('the aliasing handler relabels the raw source to TaintA', 'x <- identity(taint())', { '1@x': TaintA }, evalAnalysis);
		testCategory('the aliasing handler leaves an already-classified taint untouched', 'x <- taint()\ny <- identity(x)\nz <- identity(y)', { '2@y': TaintA, '3@z': TaintA }, evalAnalysis);
		testCategory('the computing handler passes a non-A taint through unchanged', 'x <- abs(taint())', { '1@x': Src }, evalAnalysis);
		testCategory('the computing handler escalates a TaintA argument to Top', 'x <- taint()\ny <- identity(x)\nz <- abs(y)', { '2@y': TaintA, '3@z': Top }, evalAnalysis);
		testCategory('repeated computing calls keep passing the unescalated source through', 'x <- abs(abs(taint()))', { '1@x': Src }, evalAnalysis);
	});
});
