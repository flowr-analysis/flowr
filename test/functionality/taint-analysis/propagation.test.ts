import { describe, test } from 'vitest';
import { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { AbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';
import type { LoopKind } from './loop-helper';
import { loopKinds, testLoopFixpoint, wrapLoop } from './loop-helper';
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

const marker = TaintAnalysisDefinition.create('marker', lattice)
	.from([
		{ identifier: Identifier.make('taint'), taint: TaintA },
		{ identifier: Identifier.make('TaintB'), taint: TaintB },
	]).through([]).to([]).report('');

/** Checks whether the first argument has been tainted, returning the given constant taint or undefined */
const toConst = (taint: symbol) =>
	(_args: unknown[], [incoming]: AbstractDomain<symbol, symbol, symbol>[]) => incoming.isTop() ? Top : taint;

const conflict = TaintAnalysisDefinition.create('conflict', lattice)
	.from([
		{ identifier: Identifier.make('taint'), taint: TaintA },
		{ identifier: Identifier.make('sink'), taint: TaintA },
		{ identifier: Identifier.make('reclassify'), taint: TaintA },
		{ identifier: Identifier.make('narrow'), taint: TaintC },
	])
	.through([])
	.to([
		{
			identifier: Identifier.make('sink'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: toConst(Bottom)
			}
		},
		{
			identifier: Identifier.make('reclassify'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: toConst(TaintB)
			}
		},
		{
			identifier: Identifier.make('narrow'),
			condition:  {
				argTaints:   [{ pos: 0 }],
				conditionFn: toConst(TaintB)
			}
		},
	]).report('');

function testPropagate(
	name: string,
	code: string,
	expectation: TaintAnalysisExpectation,
	analysis: TaintAnalysisDefinition = marker,
	wideningThreshold?: number
): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);

	test(effectiveName, async() => {
		await testTaintAnalysis(code, analysis, expectation, wideningThreshold);
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

	describe('User-Defined Functions', () => {
		testPropagate('taint passes through an identity function via its argument and return value', 'f <- function(v) { v }\nx <- taint()\ny <- f(x)', { '3@y': TaintA });
		testPropagate('a source called inside a user-defined function taints the returned value', 'f <- function() { taint() }\ny <- f()', { '2@y': TaintA });
		testPropagate('a user-defined function that discards its argument does not forward the taint', 'f <- function(v) { 1 }\nx <- taint()\ny <- f(x)', { '3@y': Top });
		testConflict('a sink applied inside a user-defined function maps to Bottom', 'f <- function(v) { sink(v) }\na <- taint()\ny <- f(a)', { '2@a': TaintA, '3@y': Bottom });
		testConflict('a pipe chain through user-defined functions updates the taint', `
			g <- function(v) { narrow(v) }
			h <- function(v) { sink(taint(v)) }
			a <- taint()
			y <- a |> g()
			z <- y |> h()
			`,
		{ '3@a': TaintA, '4@y': TaintB, '5@z': Bottom });
	});

	describe('Source-Sink Conflict (Greatest Lower Bound)', () => {
		testConflict('meeting the source taint with the sink finding taint (Bottom) drops to Bottom', 'a <- taint()\nx <- sink(a)', { '2@x': Bottom });
		testConflict('meeting incomparable source and sink taints drops to Bottom', 'a <- taint()\nx <- reclassify(a)', { '2@x': Bottom });
		testConflict('meeting comparable source and sink taints keeps the lower bound', 'a <- taint()\nx <- narrow(a)', { '2@x': TaintB });
		testConflict('an inapplicable sink condition (undefined) leaves the source taint', 'x <- sink(1)', { '1@x': TaintA });
		testConflict('an inapplicable sink condition (undefined) leaves the higher source taint', 'x <- narrow(1)', { '1@x': TaintC });
		testPropagate('a source called on a tainted argument returns its own source taint, ignoring the incoming taint', 'x <- taint(TaintB())', { '1@x': TaintA });
	});

	describe('Widening', () => {
		const Low = Symbol('Low');
		const Mid = Symbol('Mid');
		const High = Symbol('High');

		// a finite chain
		const chain = new FiniteDomainBuilder()
			.addLeqOrder(Bottom, Low)
			.addLeqOrder(Low, Mid)
			.addLeqOrder(Mid, High)
			.addLeqOrder(High, Top)
			.build();

		// a diamond
		const A = Symbol('A');
		const B = Symbol('B');
		const diamond = new FiniteDomainBuilder()
			.addLeqOrder(Bottom, [A, B])
			.addLeqOrder(A, Top)
			.addLeqOrder(B, Top)
			.build();

		const toTopLadder: symbol[] = [Bottom, Low, Mid, High, Top];
		const boundedLadder: symbol[] = [Bottom, Low, Mid, High];

		function walk(ladder: symbol[], dir: 1 | -1) {
			return (_args: unknown[], [t]: AbstractDomain<symbol, symbol, symbol>[]) =>
				// ensure value is within upper and lower bound
				ladder[Math.min(Math.max(ladder.indexOf(t.value ?? Bottom) + dir, 0), ladder.length - 1)];
		}

		function climber(name: string, ladder: symbol[]): TaintAnalysisDefinition {
			return TaintAnalysisDefinition.create(name, chain)
				.from([
					{ identifier: Identifier.make('bot'), taint: Bottom },
					{ identifier: Identifier.make('tainted'), taint: High },
				])
				.through([
					{ identifier: Identifier.make('oneCloserToTop'), condition: { argTaints: [{ pos: 0 }], conditionFn: walk(ladder, 1) } },
					{ identifier: Identifier.make('oneCloserToBot'), condition: { argTaints: [{ pos: 0 }], conditionFn: walk(ladder, -1) } },
				]).to([]).report('');
		}

		const climbToTop = climber('climb-to-top', toTopLadder);
		const climbBounded = climber('climb-bounded', boundedLadder);

		const merges = TaintAnalysisDefinition.create('merges', diamond)
			.from([
				{ identifier: Identifier.make('bot'), taint: Bottom },
				{ identifier: Identifier.make('taintA'), taint: A },
				{ identifier: Identifier.make('taintB'), taint: B },
			])
			.through([
				{ identifier: Identifier.make('glb'), condition: { argTaints: [{ pos: 0 }, { pos: 1 }], conditionFn: (_args, [p, q]) => (p ?? diamond.top()).meet(q ?? diamond.top()).value } },
			]).to([]).report('');

		const thresholds = [1, 2, 4, 8];

		describe('Fixpoint stability without climbing', () => {
			testLoopFixpoint(climbToTop, 'a self-assignment loop keeps the pre-loop taint', 'x <- tainted()', 'x <- x', High, thresholds);
			testLoopFixpoint(climbToTop, 'a loop re-tainting every iteration overwrites the pre-loop value', 'x <- bot()', 'x <- tainted()', High, thresholds);
		});

		describe('Climbing walkers', () => {
			testLoopFixpoint(climbToTop, 'a walker climbing an unbounded ladder reaches Top', 'x <- bot()', 'x <- oneCloserToTop(x)', Top, thresholds);
			testLoopFixpoint(climbBounded, 'a clamped walker settles at the clamp', 'x <- bot()', 'x <- oneCloserToTop(x)', High, thresholds);
			testLoopFixpoint(climbToTop, 'a walker that only maybe climbs still reaches Top', 'x <- bot()', 'if (runif(u) > 0.5) { x <- oneCloserToTop(x) }', Top, thresholds);
			testLoopFixpoint(climbBounded, 'a clamped walker that only maybe climbs still reaches the clamp', 'x <- bot()', 'if (branch) { x <- oneCloserToTop(x) }', High, thresholds);
		});

		describe('Multi-way joins', () => {
			testLoopFixpoint(merges, 'meeting a bottom value with a taint under a branch keeps it bottom', 'x <- bot()\nz <- taintB()', 'if (branch) { x <- glb(x, z) }', Bottom, thresholds);
			testLoopFixpoint(merges, 'joining incomparable taints across a branch reaches Top', 'x <- taintA()\nz <- taintB()', 'if (branch) { x <- z }', Top, thresholds);
		});

		function widenScenario(name: string, analysis: TaintAnalysisDefinition, pre: string, body: (kind: LoopKind) => string, expected: symbol | Record<LoopKind, symbol>): void {
			for(const kind of loopKinds) {
				const code = `${pre}${body(kind)}\nsink(x)\nout <- x`;
				const criterion = `${code.split('\n').length}@out`;
				const want = typeof expected === 'symbol' ? expected : expected[kind];
				for(const threshold of thresholds) {
					testPropagate(`${name} [${kind}] (threshold=${threshold})`, code, { [criterion]: want }, analysis, threshold);
				}
			}
		}

		describe('Oscillating loops', () => {
			widenScenario('a shaker stepping up then down', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, 'x <- oneCloserToTop(x)\nx <- oneCloserToBot(x)'),
				{ for: Bottom, while: Bottom, repeat: Top });
			widenScenario('a multi-shaker whose inner loop saturates before the down-step', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, `${wrapLoop(kind, 'x <- oneCloserToTop(x)', 'inner')}\nx <- oneCloserToBot(x)`),
				{ for: High, while: High, repeat: Top });
		});

		describe('Loops with break and next', () => {
			function exitWalkerBody(kind: LoopKind): string {
				const body = 'if (b1) break\nx <- oneCloserToTop(x)\nif (b2) next\nx <- oneCloserToBot(x)';
				switch(kind) {
					case 'for':    return `for (i in 1:5) {\n${body}\n}`;
					case 'while':  return `while (cond) {\n${body}\n}`;
					case 'repeat': return `repeat {\n${body}\n}`;
				}
			}
			widenScenario('a walker with early break and skip still reaches Top', climbToTop,
				'x <- bot()\n', exitWalkerBody, Top);
		});
	});
});
