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
	});

	describe('Source-Sink Conflict (Greatest Lower Bound)', () => {
		testConflict('meeting the source taint with the sink finding taint (Bottom) drops to Bottom', 'a <- taint()\nx <- sink(a)', { '2@x': Bottom });
		testConflict('meeting incomparable source and sink taints drops to Bottom', 'a <- taint()\nx <- reclassify(a)', { '2@x': Bottom });
		testConflict('meeting comparable source and sink taints keeps the lower bound', 'a <- taint()\nx <- narrow(a)', { '2@x': TaintA });
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
			return (_args: unknown[], [t]: symbol[]) =>
				// ensure value is within upper and lower bound
				ladder[Math.min(Math.max(ladder.indexOf(t ?? Bottom) + dir, 0), ladder.length - 1)];
		}

		function climber(name: string, ladder: symbol[]): TaintAnalysisDefinition {
			return new TaintAnalysisDefinition(name, chain)
				.from([
					{ identifier: Identifier.make('bot'), taint: Bottom },
					{ identifier: Identifier.make('tainted'), taint: High },
				])
				.through([
					{ identifier: Identifier.make('oneCloserToTop'), condition: { argTaints: [{ pos: 0 }], conditionFn: walk(ladder, 1) } },
					{ identifier: Identifier.make('oneCloserToBot'), condition: { argTaints: [{ pos: 0 }], conditionFn: walk(ladder, -1) } },
				]);
		}

		const climbToTop = climber('climb-to-top', toTopLadder);
		const climbBounded = climber('climb-bounded', boundedLadder);

		const merges = new TaintAnalysisDefinition('merges', diamond)
			.from([
				{ identifier: Identifier.make('bot'), taint: Bottom },
				{ identifier: Identifier.make('taintA'), taint: A },
				{ identifier: Identifier.make('taintB'), taint: B },
			])
			.through([
				{ identifier: Identifier.make('glb'), condition: { argTaints: [{ pos: 0 }, { pos: 1 }], conditionFn: (_args, [p, q]) => diamond.create(p ?? Top).meet(diamond.create(q ?? Top)).value } },
			]);

		const loopKinds = ['for', 'while', 'repeat'] as const;
		type LoopKind = typeof loopKinds[number];
		const thresholds = [1, 2, 4, 8];

		// wraps a body in each loop kind
		function wrapLoop(kind: LoopKind, body: string, cond = 'cond'): string {
			switch(kind) {
				case 'for':    return `for (i in 1:5) {\n${body}\n}`;
				case 'while':  return `while (${cond}) {\n${body}\n}`;
				case 'repeat': return `repeat {\n${body}\nif (${cond}) break\n}`;
			}
		}

		type Expected = symbol | Record<LoopKind, symbol>;

		/*
		 * Every scenario for each loop kind across every widening threshold.
		 * Widening on a finite lattice is join, so each loop results in the exact same least fixpoint (independent of the threshold).
		 */
		function widenScenario(name: string, analysis: TaintAnalysisDefinition, pre: string, body: (kind: LoopKind) => string, expected: Expected): void {
			for(const kind of loopKinds) {
				const code = `${pre}${body(kind)}\nsink(x)\nout <- x`;
				const criterion = `${code.split('\n').length}@out`;
				const want = typeof expected === 'symbol' ? expected : expected[kind];
				for(const threshold of thresholds) {
					testPropagate(`${name} [${kind}] (threshold=${threshold})`, code, { [criterion]: want }, analysis, threshold);
				}
			}
		}

		describe('Fixpoint stability without climbing', () => {
			widenScenario('a self-assignment loop keeps the pre-loop taint', climbToTop,
				'x <- tainted()\n', kind => wrapLoop(kind, 'x <- x'), High);
			widenScenario('a loop re-tainting every iteration overwrites the pre-loop value', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, 'x <- tainted()'), High);
		});

		describe('Climbing walkers', () => {
			widenScenario('a walker climbing an unbounded ladder reaches Top', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, 'x <- oneCloserToTop(x)'), Top);
			widenScenario('a clamped walker settles at the clamp', climbBounded,
				'x <- bot()\n', kind => wrapLoop(kind, 'x <- oneCloserToTop(x)'), High);
			widenScenario('a walker that only maybe climbs still reaches Top', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, 'if (runif(u) > 0.5) { x <- oneCloserToTop(x) }'), Top);
			widenScenario('a clamped walker that only maybe climbs still reaches the clamp', climbBounded,
				'x <- bot()\n', kind => wrapLoop(kind, 'if (branch) { x <- oneCloserToTop(x) }'), High);
		});

		describe('Oscillating loops', () => {
			widenScenario('a shaker stepping up then down', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, 'x <- oneCloserToTop(x)\nx <- oneCloserToBot(x)'),
				{ for: Bottom, while: Bottom, repeat: Top });
			widenScenario('a multi-shaker whose inner loop saturates before the down-step', climbToTop,
				'x <- bot()\n', kind => wrapLoop(kind, `${wrapLoop(kind, 'x <- oneCloserToTop(x)', 'inner')}\nx <- oneCloserToBot(x)`),
				{ for: High, while: High, repeat: Top });
		});

		describe('Multi-way joins', () => {
			widenScenario('meeting a bottom value with a taint under a branch keeps it bottom', merges,
				'x <- bot()\ny <- taintB()\n', kind => wrapLoop(kind, 'if (branch) { x <- glb(x, y) }'), Bottom);
			widenScenario('joining incomparable taints across a branch reaches Top', merges,
				'x <- taintA()\ny <- taintB()\n', kind => wrapLoop(kind, 'if (branch) { x <- y }'), Top);
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
