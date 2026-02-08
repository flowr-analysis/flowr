import { withTreeSitter } from '../_helper/shell';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/controlflow/assert-control-flow-graph';
import { CfgEdge, CfgVertex, ControlFlowGraph } from '../../../src/control-flow/control-flow-graph';

describe('Control Flow Graph', withTreeSitter(parser => {
	describe('Without Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: [ '3' ],
			exitPoints:  [ CfgVertex.toExitId(3) ],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeExpression(0))
				.addVertex(CfgVertex.makeExpression(1))
				.addVertex(CfgVertex.makeExpressionWithEnd(2))
				.addVertex(CfgVertex.makeExitMarker(2))
				.addVertex(CfgVertex.makeExpressionWithEnd(3))
				.addVertex(CfgVertex.makeExitMarker(3))

				.addEdge(2, 3, CfgEdge.makeFd())
				.addEdge(0, 2, CfgEdge.makeFd())
				.addEdge(1, 0, CfgEdge.makeFd())
				.addEdge(CfgVertex.toExitId(2), 1, CfgEdge.makeFd())
				.addEdge(CfgVertex.toExitId(3), CfgVertex.toExitId(2), CfgEdge.makeFd())
		});

		assertCfg(parser, 'df$name', {
			entryPoints: [ '4' ],
			exitPoints:  [ CfgVertex.toExitId(4) ],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeExpressionWithEnd(4))
				.addVertex(CfgVertex.makeExitMarker(4))
				.addVertex(CfgVertex.makeExpressionWithEnd(3, { mid: [0] }))
				.addVertex(CfgVertex.makeExitMarker(3))
				.addVertex(CfgVertex.makeExpressionWithEnd(2, { mid: [2] }))
				.addVertex(CfgVertex.makeExitMarker(2))
				.addVertex(CfgVertex.makeExpression(0))
				.addVertex(CfgVertex.makeExpression(1))
				.addEdge(3, 4, CfgEdge.makeFd())
				.addEdge(0, 3, CfgEdge.makeFd())
				.addEdge(2, 0, CfgEdge.makeFd())
				.addEdge(1, 2, CfgEdge.makeFd())
				.addEdge(CfgVertex.toExitId(2), 1, CfgEdge.makeFd())
				.addEdge(CfgVertex.toExitId(3), CfgVertex.toExitId(2), CfgEdge.makeFd())
				.addEdge(CfgVertex.toExitId(4), CfgVertex.toExitId(3), CfgEdge.makeFd())
		});

		describe('conditionals', () => {
			assertCfg(parser, 'if(TRUE) 1', {
				entryPoints: [ '4' ],
				exitPoints:  [ CfgVertex.toExitId(4) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeStatementWithEnd(3, { mid: [0] }))
					.addVertex(CfgVertex.makeExpressionWithEnd(4))
					.addVertex(CfgVertex.makeExitMarker(4))
					.addVertex(CfgVertex.makeExpressionWithEnd(2))
					.addVertex(CfgVertex.makeExitMarker(2))
					.addVertex(CfgVertex.makeExitMarker(3))
					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
					.addEdge(1, 2, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(2), 1, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(3), CfgVertex.toExitId(2), CfgEdge.makeFd())
					.addEdge(2, 0, CfgEdge.makeCdTrue(3))
					.addEdge(CfgVertex.toExitId(3), 0, CfgEdge.makeCdFalse(3))
					.addEdge(CfgVertex.toExitId(4), CfgVertex.toExitId(3), CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {}', {
				entryPoints: [ '5' ],
				exitPoints:  [ CfgVertex.toExitId(5) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatementWithEnd(4, { mid: [0] }))
					.addVertex(CfgVertex.makeExitMarker(4))
					.addVertex(CfgVertex.makeExpressionWithEnd(5))
					.addVertex(CfgVertex.makeExitMarker(5))
					.addVertex(CfgVertex.makeExpressionWithEnd(3))
					.addVertex(CfgVertex.makeExitMarker(3))
					.addEdge(4, 5, CfgEdge.makeFd())
					.addEdge(0, 4, CfgEdge.makeFd())
					.addEdge(3, 0, CfgEdge.makeCdTrue(4))
					.addEdge(CfgVertex.toExitId(3), 3, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(4), CfgVertex.toExitId(3), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(4), 0, CfgEdge.makeCdFalse(4))
					.addEdge(CfgVertex.toExitId(5), CfgVertex.toExitId(4), CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {} else {}', {
				entryPoints: [ '8' ],
				exitPoints:  [ CfgVertex.toExitId(8) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatementWithEnd(7, { mid: [0] }))
					.addVertex(CfgVertex.makeExitMarker(7))
					.addVertex(CfgVertex.makeExpressionWithEnd(8))
					.addVertex(CfgVertex.makeExitMarker(8))
					.addVertex(CfgVertex.makeExpressionWithEnd(6))
					.addVertex(CfgVertex.makeExitMarker(6))
					.addVertex(CfgVertex.makeExpressionWithEnd(3))
					.addVertex(CfgVertex.makeExitMarker(3))
					.addEdge(7, 8, CfgEdge.makeFd())
					.addEdge(0, 7, CfgEdge.makeFd())

					.addEdge(3, 0, CfgEdge.makeCdTrue(7))
					.addEdge(6, 0, CfgEdge.makeCdFalse(7))

					.addEdge(CfgVertex.toExitId(3), 3, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(6), 6, CfgEdge.makeFd())

					.addEdge(CfgVertex.toExitId(7), CfgVertex.toExitId(3), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(7), CfgVertex.toExitId(6), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(8), CfgVertex.toExitId(7), CfgEdge.makeFd())
			});

			assertCfg(parser, 'f <- function() if (u) return(42) else return(1)', {
				entryPoints: [ '4' ],
				exitPoints:  [ CfgVertex.toExitId(4) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeStatementWithEnd(5), false)
					.addVertex(CfgVertex.makeStatementWithEnd(10), false)
					.addEdge(CfgVertex.toExitId(14), CfgVertex.toExitId(5), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(14), CfgVertex.toExitId(10), CfgEdge.makeFd())
			}, { simplificationPasses: ['analyze-dead-code'], expectIsSubgraph: true });

		});

		describe('loops', () => {
			assertCfg(parser, `while (a) {
	if (b) {
		next
	}
	c
}
	`, {
				entryPoints: [ '12' ],
				exitPoints:  [ CfgVertex.toExitId(12) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpressionWithEnd(12))
					.addVertex(CfgVertex.makeExitMarker(12))
					.addVertex(CfgVertex.makeStatementWithEnd(11, { mid: [0] }))
					.addVertex(CfgVertex.makeExitMarker(11))
					.addVertex(CfgVertex.makeExpression(0))

					.addVertex(CfgVertex.makeExpressionWithEnd(10))
					.addVertex(CfgVertex.makeExitMarker(10))
					.addVertex(CfgVertex.makeStatementWithEnd(8, { mid: [3] }))
					.addVertex(CfgVertex.makeExitMarker(8))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeExpression(7))
					.addVertex(CfgVertex.makeStatement(6))
					.addVertex(CfgVertex.makeExpression(9))

					.addEdge(11, 12, CfgEdge.makeFd())
					.addEdge(0, 11, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(11), 0, CfgEdge.makeCdFalse(11))
					.addEdge(CfgVertex.toExitId(12), CfgVertex.toExitId(11), CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeCdTrue(11))
					.addEdge(8, 10, CfgEdge.makeFd())
					.addEdge(3, 8, CfgEdge.makeFd())
					.addEdge(7, 3, CfgEdge.makeCdTrue(8))
					.addEdge(CfgVertex.toExitId(8), 3, CfgEdge.makeCdFalse(8))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(11, 6, CfgEdge.makeFd())
					.addEdge(9, CfgVertex.toExitId(8), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(10), 9, CfgEdge.makeFd())
					.addEdge(11, CfgVertex.toExitId(10), CfgEdge.makeFd())
			});

			assertCfg(parser, `while (a) {
	if (b) {
		break
	}
	c
}
	`, {
				entryPoints: [ '12' ],
				exitPoints:  [ CfgVertex.toExitId(12) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpressionWithEnd(12))
					.addVertex(CfgVertex.makeExitMarker(12))
					.addVertex(CfgVertex.makeStatementWithEnd(11, { mid: [0] }))
					.addVertex(CfgVertex.makeExitMarker(11))
					.addVertex(CfgVertex.makeExpression(0))

					.addVertex(CfgVertex.makeExpressionWithEnd(10))
					.addVertex(CfgVertex.makeExitMarker(10))
					.addVertex(CfgVertex.makeStatementWithEnd(8, { mid: [3] }))
					.addVertex(CfgVertex.makeExitMarker(8))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeExpression(7))
					.addVertex(CfgVertex.makeStatement(6))
					.addVertex(CfgVertex.makeExpression(9))

					.addEdge(11, 12, CfgEdge.makeFd())
					.addEdge(0, 11, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(11), 0, CfgEdge.makeCdFalse(11))
					.addEdge(CfgVertex.toExitId(12), CfgVertex.toExitId(11), CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeCdTrue(11))
					.addEdge(8, 10, CfgEdge.makeFd())
					.addEdge(3, 8, CfgEdge.makeFd())
					.addEdge(7, 3, CfgEdge.makeCdTrue(8))
					.addEdge(CfgVertex.toExitId(8), 3, CfgEdge.makeCdFalse(8))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(11), 6, CfgEdge.makeFd())
					.addEdge(9, CfgVertex.toExitId(8), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(10), 9, CfgEdge.makeFd())
					.addEdge(11, CfgVertex.toExitId(10), CfgEdge.makeFd())
			});
		});

		describe('function calls', () => {
			assertCfg(parser, 'print(x)', {
				entryPoints: [ '4' ],
				exitPoints:  [ CfgVertex.toExitId(4) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpressionWithEnd(4))
					.addVertex(CfgVertex.makeStatementWithEnd(3, { mid: [0] }))
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpressionWithEnd(2, { mid: [2] }))
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeExitMarker(2))
					.addVertex(CfgVertex.makeExitMarker(3))
					.addVertex(CfgVertex.makeExitMarker(4))

					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
					.addEdge(2, 0, CfgEdge.makeFd())
					.addEdge(1, 2, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(2), 1, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(3), CfgVertex.toExitId(2), CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(4), CfgVertex.toExitId(3), CfgEdge.makeFd())
			});

			assertCfg(parser, 'f(2 + 3, x=3)', {
				entryPoints: [ '9' ],
				exitPoints:  [ CfgVertex.toExitId(9) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatementWithEnd(8, { mid: [0] }))
					.addVertex(CfgVertex.makeExitMarker(8))

					.addVertex(CfgVertex.makeExpressionWithEnd(4, { mid: [4] }))
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeExpression(2))
					.addVertex(CfgVertex.makeExpressionWithEnd(3))
					.addVertex(CfgVertex.makeExitMarker(3))
					.addVertex(CfgVertex.makeExitMarker(4))

					.addVertex(CfgVertex.makeExpressionWithEnd(7, { mid: [5] }))
					.addVertex(CfgVertex.makeExpression(5))
					.addVertex(CfgVertex.makeExpression(6))
					.addVertex(CfgVertex.makeExitMarker(7))

					.addVertex(CfgVertex.makeExpressionWithEnd(9))
					.addVertex(CfgVertex.makeExitMarker(9))

					.addEdge(8, 9, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(9), CfgVertex.toExitId(8), CfgEdge.makeFd())

					.addEdge(0, 8, CfgEdge.makeFd())
					.addEdge(4, 0, CfgEdge.makeFd())
					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(1, 3, CfgEdge.makeFd())
					.addEdge(2, 1, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(3), 2, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(4), CfgVertex.toExitId(3), CfgEdge.makeFd())

					.addEdge(7, CfgVertex.toExitId(4), CfgEdge.makeFd())
					.addEdge(5, 7, CfgEdge.makeFd())
					.addEdge(6, 5, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(7), 6, CfgEdge.makeFd())
					.addEdge(CfgVertex.toExitId(8), CfgVertex.toExitId(7), CfgEdge.makeFd())
			});

			assertCfg(parser, 'f <- function(x) x\nf()', {
				entryPoints: [ '9' ],
				exitPoints:  [ CfgVertex.toExitId(9) ],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpressionWithEnd(5))
					.addVertex(CfgVertex.makeStatementWithEnd(8, { callTargets: new Set([5]) }))
			}, { expectIsSubgraph: true });
		});
	});
	describe('With Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: [ CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)) ],
			exitPoints:  [ CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)) ],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock(
					CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)),
					[
						CfgVertex.makeExitMarker(3),
						CfgVertex.makeExitMarker(2),
						CfgVertex.makeExpression(1),
						CfgVertex.makeExpression(0),
						CfgVertex.makeExpressionWithEnd(2),
						CfgVertex.makeExpressionWithEnd(3),
					]
				))
		}, { withBasicBlocks: true });

		assertCfg(parser, 'if(TRUE) {} else {}', {
			entryPoints: [CfgVertex.toBasicBlockId(0)],
			exitPoints:  [CfgVertex.toBasicBlockId(CfgVertex.toExitId(8))],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(0),
					[
						CfgVertex.makeExpression(0),
						CfgVertex.makeStatementWithEnd(7, { mid: [0] }),
						CfgVertex.makeExpressionWithEnd(8)
					]
				))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)), [
					CfgVertex.makeExitMarker(3),
					CfgVertex.makeExpressionWithEnd(3)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(6)), [
					CfgVertex.makeExitMarker(6),
					CfgVertex.makeExpressionWithEnd(6)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(8)), [
					CfgVertex.makeExitMarker(8),
					CfgVertex.makeExitMarker(7)
				]))
				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(8)), CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)), CfgEdge.makeFd())
				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(8)), CfgVertex.toBasicBlockId(CfgVertex.toExitId(6)), CfgEdge.makeFd())

				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(3)), CfgVertex.toBasicBlockId(0), CfgEdge.makeCdTrue(7))
				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(6)), CfgVertex.toBasicBlockId(0), CfgEdge.makeCdFalse(7))
		}, { withBasicBlocks: true });

		assertCfg(parser, 'print(x)', {
			entryPoints: [ CfgVertex.toBasicBlockId(CfgVertex.toExitId(4)) ],
			exitPoints:  [ CfgVertex.toBasicBlockId(CfgVertex.toExitId(4)) ],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(4)), [
					CfgVertex.makeExitMarker(4),
					CfgVertex.makeExitMarker(3),
					CfgVertex.makeExitMarker(2),
					CfgVertex.makeExpression(1),
					CfgVertex.makeExpressionWithEnd(2, { mid: [2] }),
					CfgVertex.makeExpression(0),
					CfgVertex.makeStatementWithEnd(3, { mid: [0] }),
					CfgVertex.makeExpressionWithEnd(4)
				]))

		}, { withBasicBlocks: true });

		assertCfg(parser, `while (a) {
	if (b) {
		break
	}
	c
}
	`, {
			entryPoints: [ CfgVertex.toBasicBlockId(12) ],
			exitPoints:  [ CfgVertex.toBasicBlockId(CfgVertex.toExitId(12)) ],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(12), [
					CfgVertex.makeExpressionWithEnd(12)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(0), [
					CfgVertex.makeExpression(0),
					CfgVertex.makeStatementWithEnd(11, { mid: [0] })
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(10)), [
					CfgVertex.makeExitMarker(10),
					CfgVertex.makeExpression(9),
					CfgVertex.makeExitMarker(8)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(3), [
					CfgVertex.makeExpression(3),
					CfgVertex.makeStatementWithEnd(8, { mid: [3] }),
					CfgVertex.makeExpressionWithEnd(10)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(6), [
					CfgVertex.makeStatement(6),
					CfgVertex.makeExpression(7)
				]))
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(12)), [
					CfgVertex.makeExitMarker(12),
					CfgVertex.makeExitMarker(11)
				]))

				.addEdge(CfgVertex.toBasicBlockId(0), CfgVertex.toBasicBlockId(12), CfgEdge.makeFd())
				.addEdge(CfgVertex.toBasicBlockId(0), CfgVertex.toBasicBlockId(CfgVertex.toExitId(10)), CfgEdge.makeFd())

				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(10)), CfgVertex.toBasicBlockId(3), CfgEdge.makeCdFalse(8))
				.addEdge(CfgVertex.toBasicBlockId(3), CfgVertex.toBasicBlockId(0), CfgEdge.makeCdTrue(11))
				.addEdge(CfgVertex.toBasicBlockId(6), CfgVertex.toBasicBlockId(3), CfgEdge.makeCdTrue(8))
				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(12)), CfgVertex.toBasicBlockId(0), CfgEdge.makeCdFalse(11))
				.addEdge(CfgVertex.toBasicBlockId(CfgVertex.toExitId(12)), CfgVertex.toBasicBlockId(6), CfgEdge.makeFd())

		}, { withBasicBlocks: true });

		assertCfg(parser, 'f <- function(x) x\nf()', {
			entryPoints: [CfgVertex.toBasicBlockId(5)],
			exitPoints:  [CfgVertex.toBasicBlockId(CfgVertex.toExitId(9))],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock(CfgVertex.toBasicBlockId(CfgVertex.toExitId(8)), [
					CfgVertex.makeExitMarker(8),
					CfgVertex.makeExpression(7),
					CfgVertex.makeStatementWithEnd(8, { callTargets: new Set([5]), mid: [0] }),
					CfgVertex.makeExitMarker(6)
				]))
		}, { expectIsSubgraph: true, withBasicBlocks: true });
	});
}));
