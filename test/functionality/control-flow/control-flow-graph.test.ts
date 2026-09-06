import { withTreeSitter } from '../_helper/shell';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/controlflow/assert-control-flow-graph';
import { CfgEdge, CfgVertex, ControlFlowGraph } from '../../../src/control-flow/control-flow-graph';

const whileNext = `while (a) {
	if (b) {
		next
	}
	c
}
	`;
const whileBreak = `while (a) {
	if (b) {
		break
	}
	c
}
	`;
const foreachCode = `result <- foreach(i = vec) %do% {
    # ...
    return(x)
}`;

describe('Control Flow Graph', withTreeSitter(parser => {
	describe('Without Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: [0],
			exitPoints:  [2],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeExpression(0))
				.addVertex(CfgVertex.makeExpression(1))
				.addVertex(CfgVertex.makeStatement(2))
				.addEdge(0, 1, CfgEdge.makeFd())
				.addEdge(1, 2, CfgEdge.makeFd())
		});

		assertCfg(parser, 'df$name', {
			entryPoints: [0],
			exitPoints:  [3],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeExpression(0))
				.addVertex(CfgVertex.makeExpression(1))
				.addVertex(CfgVertex.makeStatement(3))
				.addEdge(0, 1, CfgEdge.makeFd())
				.addEdge(1, 3, CfgEdge.makeFd())
		});

		describe('conditionals', () => {
			assertCfg(parser, 'if(TRUE) 1', {
				entryPoints: [0],
				exitPoints:  [3],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatement(1))
					.addVertex(CfgVertex.makeStatement(3))
					/* the condition is known, so there is only one way to go */
					.addEdge(0, 1, CfgEdge.makeFd())
					.addEdge(1, 3, CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {}', {
				entryPoints: [0],
				exitPoints:  [4],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeStatement(4))
					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {} else {}', {
				entryPoints: [0],
				exitPoints:  [7],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeStatement(7))
					.addEdge(3, 7, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
			});

			assertCfg(parser, 'f <- function() if (u) return(42) else return(1)', {
				entryPoints: [14],
				exitPoints:  [15],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(1), false)
					.addVertex(CfgVertex.makeExpression(3), false)
					.addVertex(CfgVertex.makeStatement(5), false)
					.addVertex(CfgVertex.makeExpression(8), false)
					.addVertex(CfgVertex.makeStatement(10), false)
					.addVertex(CfgVertex.makeStatement(12), false)
					.addVertex(CfgVertex.makeExpression(14, { children: [1] }))
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatement(15))
					.addEdge(3, 5, CfgEdge.makeFd())
					.addEdge(8, 10, CfgEdge.makeFd())
					.addEdge(1, 3, CfgEdge.makeCdTrue(12))
					.addEdge(1, 8, CfgEdge.makeCdFalse(12))
					.addEdge(14, 0, CfgEdge.makeFd())
					.addEdge(0, 15, CfgEdge.makeFd())
			}, { simplificationPasses: ['analyze-dead-code'], excludeProperties: ['entry-reaches-all', 'exit-reaches-all'] });
		});

		describe('loops', () => {
			assertCfg(parser, whileNext, {
				entryPoints: [0],
				exitPoints:  [11],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeStatement(6))
					.addVertex(CfgVertex.makeExpression(7))
					.addVertex(CfgVertex.makeStatement(8))
					.addVertex(CfgVertex.makeStatement(9))
					.addVertex(CfgVertex.makeExpression(10))
					.addVertex(CfgVertex.makeStatement(11))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(7, 0, CfgEdge.makeFd())
					.addEdge(8, 9, CfgEdge.makeFd())
					.addEdge(3, 6, CfgEdge.makeCdTrue(8))
					.addEdge(3, 8, CfgEdge.makeCdFalse(8))
					.addEdge(9, 10, CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeCdTrue(11))
					.addEdge(0, 11, CfgEdge.makeCdFalse(11))
			});

			assertCfg(parser, whileBreak, {
				entryPoints: [0],
				exitPoints:  [11],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeStatement(6))
					.addVertex(CfgVertex.makeExpression(7))
					.addVertex(CfgVertex.makeStatement(8))
					.addVertex(CfgVertex.makeStatement(9))
					.addVertex(CfgVertex.makeExpression(10))
					.addVertex(CfgVertex.makeStatement(11))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(7, 11, CfgEdge.makeFd())
					.addEdge(8, 9, CfgEdge.makeFd())
					.addEdge(3, 6, CfgEdge.makeCdTrue(8))
					.addEdge(3, 8, CfgEdge.makeCdFalse(8))
					.addEdge(9, 10, CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeCdTrue(11))
					.addEdge(0, 11, CfgEdge.makeCdFalse(11))
			});
		});

		describe('function calls', () => {
			assertCfg(parser, 'print(x)', {
				entryPoints: [1],
				exitPoints:  [3],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeStatement(3))
					.addEdge(1, 3, CfgEdge.makeFd())
			});

			assertCfg(parser, 'f(2 + 3, x=3)', {
				entryPoints: [1],
				exitPoints:  [8],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeExpression(2))
					.addVertex(CfgVertex.makeExpression(3))
					.addVertex(CfgVertex.makeExpression(6))
					.addVertex(CfgVertex.makeExpression(7))
					.addVertex(CfgVertex.makeStatement(8))
					.addEdge(3, 6, CfgEdge.makeFd())
					.addEdge(1, 2, CfgEdge.makeFd())
					.addEdge(2, 3, CfgEdge.makeFd())
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(7, 8, CfgEdge.makeFd())
			});

			assertCfg(parser, 'f <- function(x) x\nf()', {
				entryPoints: [5],
				exitPoints:  [8],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(1), false)
					.addVertex(CfgVertex.makeStatement(3), false)
					.addVertex(CfgVertex.makeExpression(5, { children: [1] }))
					.addVertex(CfgVertex.makeExpression(0))
					.addVertex(CfgVertex.makeStatement(6))
					.addVertex(CfgVertex.makeStatement(8, { callTargets: new Set([5]) }))
					.addEdge(1, 3, CfgEdge.makeFd())
					.addEdge(6, 8, CfgEdge.makeFd())
					.addEdge(5, 0, CfgEdge.makeFd())
					.addEdge(0, 6, CfgEdge.makeFd())
			});
		});

		assertCfg(parser, foreachCode, {
			entryPoints: [4],
			exitPoints:  [17],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeExpression(4))
				.addVertex(CfgVertex.makeExpression(5))
				.addVertex(CfgVertex.makeExpression(6))
				.addVertex(CfgVertex.makeExpression(11))
				.addVertex(CfgVertex.makeStatement(13))
				.addVertex(CfgVertex.makeExpression(14))
				.addVertex(CfgVertex.makeExpression(16))
				.addVertex(CfgVertex.makeExpression(0))
				.addVertex(CfgVertex.makeStatement(17))
				.addEdge(4, 5, CfgEdge.makeFd())
				.addEdge(5, 6, CfgEdge.makeFd())
				.addEdge(6, 11, CfgEdge.makeFd())
				.addEdge(11, 13, CfgEdge.makeFd())
				/* the `return` leaves the `{` it sits in, which the loop then carries on from */
				.addEdge(13, 14, CfgEdge.makeFd())
				/* `%do%` evaluates its body with `eval`, so the `return` there hands its value on rather than erroring */
				.addEdge(13, 0, CfgEdge.makeFd())
				.addEdge(0, 17, CfgEdge.makeFd())
		}, { excludeProperties: ['entry-reaches-all', 'exit-reaches-all'] });

		describe('faulty uses', () => {
			assertCfg(parser, 'ifelse()', {
				entryPoints: [1],
				exitPoints:  [1],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeStatement(1))
			});

			assertCfg(parser, 'ifelse(x)', {
				entryPoints: [1],
				exitPoints:  [3],
				graph:       new ControlFlowGraph()
					.addVertex(CfgVertex.makeExpression(1))
					.addVertex(CfgVertex.makeStatement(3))
					.addEdge(1, 3, CfgEdge.makeFd())
			});
		});
	});

	describe('With Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: ['bb-0'],
			exitPoints:  ['bb-0'],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock('bb-0', [
					CfgVertex.makeExpression(0),
					CfgVertex.makeExpression(1),
					CfgVertex.makeStatement(2)
				]))
		}, { withBasicBlocks: true });

		/* the condition is known, so nothing branches and everything ends up in one block */
		assertCfg(parser, 'if(TRUE) {} else {}', {
			entryPoints: ['bb-0'],
			exitPoints:  ['bb-0'],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock('bb-0', [
					CfgVertex.makeExpression(0),
					CfgVertex.makeExpression(3),
					CfgVertex.makeStatement(7)
				]))
		}, { withBasicBlocks: true });

		assertCfg(parser, 'print(x)', {
			entryPoints: ['bb-1'],
			exitPoints:  ['bb-1'],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock('bb-1', [
					CfgVertex.makeExpression(1),
					CfgVertex.makeStatement(3)
				]))
		}, { withBasicBlocks: true });

		assertCfg(parser, whileBreak, {
			entryPoints: ['bb-8'],
			exitPoints:  ['bb-11'],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock('bb-3', [
					CfgVertex.makeExpression(3)
				]))
				/* the jump joins its block, so the two are one straight line and one block */
				.addVertex(CfgVertex.makeBlock('bb-6', [
					CfgVertex.makeStatement(6),
					CfgVertex.makeExpression(7)
				]))
				.addVertex(CfgVertex.makeBlock('bb-8', [
					CfgVertex.makeStatement(8),
					CfgVertex.makeStatement(9),
					CfgVertex.makeExpression(10),
					CfgVertex.makeExpression(0)
				]))
				.addVertex(CfgVertex.makeBlock('bb-11', [
					CfgVertex.makeStatement(11)
				]))
				.addEdge('bb-6', 'bb-11', CfgEdge.makeFd())
				.addEdge('bb-3', 'bb-6', CfgEdge.makeCdTrue(8))
				.addEdge('bb-3', 'bb-8', CfgEdge.makeCdFalse(8))
				.addEdge('bb-8', 'bb-3', CfgEdge.makeCdTrue(11))
				.addEdge('bb-8', 'bb-11', CfgEdge.makeCdFalse(11))
		}, { withBasicBlocks: true, excludeProperties: ['entry-reaches-all', 'exit-reaches-all'] });

		assertCfg(parser, 'f <- function(x) x\nf()', {
			entryPoints: ['bb-5'],
			exitPoints:  ['bb-5'],
			graph:       new ControlFlowGraph()
				.addVertex(CfgVertex.makeBlock('bb-5', [
					CfgVertex.makeExpression(5, { children: [1] }),
					CfgVertex.makeExpression(0),
					CfgVertex.makeStatement(6),
					CfgVertex.makeStatement(8, { callTargets: new Set([5]) })
				]))
		}, { withBasicBlocks: true });
	});
}));
