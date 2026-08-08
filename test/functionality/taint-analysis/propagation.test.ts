import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { testTaintAnalysis } from './helper';

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

describe('Taint Propagation', () => {
	describe('Assignment Forms', () => {
		test('left arrow', async() => {
			await testTaintAnalysis('x <- taint()\ny <- x', marker, { '2@y': TaintA });
		});
		test('equals', async() => {
			await testTaintAnalysis('x = taint()\ny = x', marker, { '2@y': TaintA });
		});
		test('right arrow', async() => {
			await testTaintAnalysis('taint() -> x\nx -> y', marker, { '2@y': TaintA });
		});
		test('global left arrow', async() => {
			await testTaintAnalysis('x <<- taint()', marker, { '1@x': TaintA });
		});
		test('assign() with a literal (statically resolvable) target', async() => {
			await testTaintAnalysis('assign("x", taint())\ny <- x', marker, { '2@y': TaintA });
		});
		test('reassignment to an untracked literal clears the prior taint', async() => {
			await testTaintAnalysis('x <- taint()\nx <- 1\ny <- x', marker, { '3@y': undefined });
		});
	});

	describe('Control Flow Joins', () => {
		test('both branches produce the same taint', async() => {
			await testTaintAnalysis('if (cond) { x <- taint() } else { x <- taint() }\ny <- x', marker, { '2@y': TaintA });
		});
		test('branches produce incomparable taints, joining to their common upper bound', async() => {
			await testTaintAnalysis('if (cond) { x <- taint() } else { x <- TaintB() }\ny <- x', marker, { '2@y': TaintC });
		});
		test('one branch is explicit Top (an unmapped call), joining to Top', async() => {
			await testTaintAnalysis('if (cond) { x <- taint() } else { x <- unmappedFn() }\ny <- x', marker, { '2@y': Top });
		});
		test('if without else: a tainted pre-if value is properly joined post-if', async() => {
			await testTaintAnalysis('x <- taint()\nif (cond) { x <- TaintB() }\ny <- x', marker, { '3@y': TaintC });
		});
		test('if without else: an untracked pre-if value makes the post-if read Top', async() => {
			await testTaintAnalysis('x <- 1\nif (cond) { x <- taint() }\ny <- x', marker, { '3@y': undefined });
		});
	});

	describe('Loops', () => {
		test('taint assigned every iteration, but the pre-loop value is untracked: post-loop read is Top', async() => {
			await testTaintAnalysis('x <- 1\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', marker, { '5@y': undefined });
		});
		test('same shape with a while loop', async() => {
			await testTaintAnalysis('x <- 1\nwhile (cond) {\n  x <- taint()\n}\ny <- x', marker, { '5@y': undefined });
		});
		test('pre-loop value is an explicit Top (not untracked): post-loop read joins to Top', async() => {
			await testTaintAnalysis('x <- unmappedFn()\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', marker, { '5@y': Top });
		});
		test('pre-loop value already carries the same taint the loop reassigns every iteration: the fixpoint stays concrete', async() => {
			await testTaintAnalysis('x <- taint()\nfor (i in 1:3) {\n  x <- taint()\n}\ny <- x', marker, { '5@y': TaintA });
		});
		test('the loop reassigns to a different, incomparable taint: the post-loop read joins the pre-loop and body taints', async() => {
			await testTaintAnalysis('x <- taint()\nfor (i in 1:3) {\n  x <- TaintB()\n}\ny <- x', marker, { '5@y': TaintC });
		});
	});

	describe('Expression Structure', () => {
		test('pipe forwards the taint of the final stage', async() => {
			await testTaintAnalysis('y <- 1 |> taint()', marker, { '1@y': TaintA });
		});
		test('a `{ ...; last }` block takes the taint of its last expression only', async() => {
			await testTaintAnalysis('y <- { 1; taint() }', marker, { '1@y': TaintA });
		});
	});

	describe('Value Loss Through Unmapped Operations', () => {
		test('reading through an unmapped regular function call yields Top', async() => {
			await testTaintAnalysis('x <- taint()\ny <- unmappedFn(x)', marker, { '2@y': Top });
		});
	});
});
