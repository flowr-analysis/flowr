import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { testTaintAnalysis, type TaintAnalysisExpectation } from './helper';
import { decorateLabelContext, label } from '../_helper/label';

const TaintA = Symbol('TaintA');
const TaintB = Symbol('TaintB');
const TaintC = Symbol('TaintC');

const lattice = new FiniteDomainBuilder()
	.addLeqOrder(Bottom, [TaintA, TaintB])
	.addLeqOrder(TaintA, TaintC)
	.addLeqOrder(TaintB, TaintC)
	.addLeqOrder(TaintC, Top)
	.build();

const marker = new TaintAnalysisDefinition('marker', lattice)
	.from([
		{ identifier: Identifier.make('taint'), taint: TaintA },
		{ identifier: Identifier.make('TaintB'), taint: TaintB },
	]);

const conflict = new TaintAnalysisDefinition('conflict', lattice)
	.from([
		{ identifier: Identifier.make('taint'), taint: TaintA },
		{ identifier: Identifier.make('sink'), taint: TaintA },
		{ identifier: Identifier.make('reclassify'), taint: TaintA },
		{ identifier: Identifier.make('narrow'), taint: TaintC },
	])
	.to([
		{
			identifier: Identifier.make('sink'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: (_args, [taint]) => taint === undefined ? undefined : Bottom
			}
		},
		{
			identifier: Identifier.make('reclassify'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: (_args, [taint]) => taint === undefined ? undefined : TaintB
			}
		},
		{
			identifier: Identifier.make('narrow'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: (_args, [taint]) => taint === undefined ? undefined : TaintA
			}
		},
	]);

function testPropagate(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);

	test(effectiveName, async() => {
		await testTaintAnalysis(code, marker, expectation);
	});
}

function testConflict(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);

	test(effectiveName, async() => {
		await testTaintAnalysis(code, conflict, expectation);
	});
}

describe('Taint Propagation', () => {
	describe('Assignment Forms', () => {
		testPropagate('left arrow', 'x <- taint()\ny <- x', { '2@y': TaintA });
		testPropagate('equals', 'x = taint()\ny = x', { '2@y': TaintA });
		testPropagate('right arrow', 'taint() -> x\nx -> y', { '2@y': TaintA });
		testPropagate('global left arrow', 'x <<- taint()', { '1@x': TaintA });
		testPropagate('assign() with a literal (statically resolvable) target', 'assign("x", taint())\ny <- x', { '2@y': TaintA });
		testPropagate('reassignment to an untracked literal clears prior taint', 'x <- taint()\nx <- 1\ny <- x', { '3@y': undefined });
	});

	describe('Control Flow Joins', () => {
		testPropagate('both branches produce same taint', 'if (cond) { x <- taint() } else { x <- taint() }\ny <- x', { '2@y': TaintA });
		testPropagate('branches produce incomparable taints, joining to upper bound', 'if (cond) { x <- taint() } else { x <- TaintB() }\ny <- x', { '2@y': TaintC });
		testPropagate('one branch is explicit Top, joining to Top', 'if (cond) { x <- taint() } else { x <- unmappedFn() }\ny <- x', { '2@y': Top });
		testPropagate('if without else: tainted pre-if value is properly joined post-if', 'x <- taint()\nif (cond) { x <- TaintB() }\ny <- x', { '3@y': TaintC });
		testPropagate('if without else: untracked pre-if value makes the post-if read Top', 'x <- 1\nif (cond) { x <- taint() }\ny <- x', { '3@y': undefined });
	});

	describe('Loops', () => {
		testPropagate('taint assigned every iteration, but pre-loop value is untracked: post-loop read is Top', 'x <- 1\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', { '5@y': undefined });
		testPropagate('same shape with while loop', 'x <- 1\nwhile (cond) {\n  x <- taint()\n}\ny <- x', { '5@y': undefined });
		testPropagate('pre-loop value is explicit Top (not untracked): post-loop read joins to Top', 'x <- unmappedFn()\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', { '5@y': Top });
		testPropagate('pre-loop value already carries the same taint the loop reassigns every iteration: fixpoint stays concrete', 'x <- taint()\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', { '5@y': TaintA });
		testPropagate('loop reassigns to different, incomparable taint: the post-loop read joins pre-loop and body taints', 'x <- taint()\nfor (i in 1:3) {\n  x <- TaintB()\n}\ny <- x', { '5@y': TaintC });
	});

	describe('Expression Structure', () => {
		testPropagate('pipe forwards the taint of the final stage', 'y <- 1 |> taint()', { '1@y': TaintA });
		testPropagate('a `{ ...; last }` block takes the taint of its last expression only', 'y <- { 1; taint() }', { '1@y': TaintA });
	});

	describe('Value Loss Through Unmapped Operations', () => {
		testPropagate('reading through an unmapped regular function call yields Top', 'x <- taint()\ny <- unmappedFn(x)', { '2@y': Top });
	});
});

describe('Source-Sink Conflict (Greatest Lower Bound)', () => {
	testConflict('meeting the source taint with the sink finding taint (Bottom) drops to Bottom', 'a <- taint()\nx <- sink(a)', { '2@x': Bottom });
	testConflict('meeting incomparable source and sink taints drops to Bottom', 'a <- taint()\nx <- reclassify(a)', { '2@x': Bottom });
	testConflict('meeting comparable source and sink taints keeps the lower bound', 'a <- taint()\nx <- narrow(a)', { '2@x': TaintA });
	testConflict('an inapplicable sink condition (undefined) leaves the source taint', 'x <- sink(1)', { '1@x': TaintA });
	testConflict('an inapplicable sink condition (undefined) leaves the higher source taint', 'x <- narrow(1)', { '1@x': TaintC });
});
