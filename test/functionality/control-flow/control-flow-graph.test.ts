import { withTreeSitter } from '../_helper/shell';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/controlflow/assert-control-flow-graph';
import { CfgEdge, CfgVertexType, ControlFlowGraph } from '../../../src/control-flow/control-flow-graph';

describe('Control Flow Graph', withTreeSitter(parser => {
	describe('Without Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: [ '3' ],
			exitPoints:  [ '3-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({ id: 0, type: CfgVertexType.Expression })
				.addVertex({ id: 1, type: CfgVertexType.Expression })
				.addVertex({ id: 2, type: CfgVertexType.Expression, end: ['2-exit'] })
				.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
				.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
				.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })

				.addEdge(2, 3, CfgEdge.makeFd())
				.addEdge(0, 2, CfgEdge.makeFd())
				.addEdge(1, 0, CfgEdge.makeFd())
				.addEdge('2-exit', 1, CfgEdge.makeFd())
				.addEdge('3-exit', '2-exit', CfgEdge.makeFd())
		});

		assertCfg(parser, 'df$name', {
			entryPoints: [ '4' ],
			exitPoints:  [ '4-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
				.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
				.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'], mid: [0] })
				.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
				.addVertex({ id: 2, type: CfgVertexType.Expression, end: ['2-exit'], mid: [2] })
				.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
				.addVertex({ id: 0, type: CfgVertexType.Expression })
				.addVertex({ id: 1, type: CfgVertexType.Expression })
				.addEdge(3, 4, CfgEdge.makeFd())
				.addEdge(0, 3, CfgEdge.makeFd())
				.addEdge(2, 0, CfgEdge.makeFd())
				.addEdge(1, 2, CfgEdge.makeFd())
				.addEdge('2-exit', 1, CfgEdge.makeFd())
				.addEdge('3-exit', '2-exit', CfgEdge.makeFd())
				.addEdge('4-exit', '3-exit', CfgEdge.makeFd())
		});

		describe('conditionals', () => {
			assertCfg(parser, 'if(TRUE) 1', {
				entryPoints: [ '4' ],
				exitPoints:  [ '4-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: 3, type: CfgVertexType.Statement, mid: [0], end: ['3-exit'] })
					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
					.addVertex({ id: 2, type: CfgVertexType.Expression, end: ['2-exit'] })
					.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
					.addEdge(1, 2, CfgEdge.makeFd())
					.addEdge('2-exit', 1, CfgEdge.makeFd())
					.addEdge('3-exit', '2-exit', CfgEdge.makeFd())
					.addEdge(2, 0, CfgEdge.makeCdTrue(3))
					.addEdge('3-exit', 0, CfgEdge.makeCdFalse(3))
					.addEdge('4-exit', '3-exit', CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {}', {
				entryPoints: [ '5' ],
				exitPoints:  [ '5-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 4, type: CfgVertexType.Statement, mid: [0], end: ['4-exit'] })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
					.addVertex({ id: 5, type: CfgVertexType.Expression, end: ['5-exit'] })
					.addVertex({ id: '5-exit', type: CfgVertexType.EndMarker, root: 5 })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(4, 5, CfgEdge.makeFd())
					.addEdge(0, 4, CfgEdge.makeFd())
					.addEdge(3, 0, CfgEdge.makeCdTrue(4))
					.addEdge('3-exit', 3, CfgEdge.makeFd())
					.addEdge('4-exit', '3-exit', CfgEdge.makeFd())
					.addEdge('4-exit', 0, CfgEdge.makeCdFalse(4))
					.addEdge('5-exit', '4-exit', CfgEdge.makeFd())
			});

			assertCfg(parser, 'if(TRUE) {} else {}', {
				entryPoints: [ '8' ],
				exitPoints:  [ '8-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Statement, mid: [0], end: ['7-exit'] })
					.addVertex({ id: '7-exit', type: CfgVertexType.EndMarker, root: 7 })
					.addVertex({ id: 8, type: CfgVertexType.Expression, end: ['8-exit'] })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 6, type: CfgVertexType.Expression, end: ['6-exit'] })
					.addVertex({ id: '6-exit', type: CfgVertexType.EndMarker, root: 6 })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(7, 8, CfgEdge.makeFd())
					.addEdge(0, 7, CfgEdge.makeFd())

					.addEdge(3, 0, CfgEdge.makeCdTrue(7))
					.addEdge(6, 0, CfgEdge.makeCdFalse(7))

					.addEdge('3-exit', 3, CfgEdge.makeFd())
					.addEdge('6-exit', 6, CfgEdge.makeFd())

					.addEdge('7-exit', '3-exit', CfgEdge.makeFd())
					.addEdge('7-exit', '6-exit', CfgEdge.makeFd())
					.addEdge('8-exit', '7-exit', CfgEdge.makeFd())
			});

			assertCfg(parser, 'f <- function() if (u) return(42) else return(1)', {
				entryPoints: [ '4' ],
				exitPoints:  [ '4-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 5, type: CfgVertexType.Statement, end: ['5-exit'] }, false)
					.addVertex({ id: 10, type: CfgVertexType.Statement, end: ['10-exit'] }, false)
					.addEdge('14-exit', '5-exit', CfgEdge.makeFd())
					.addEdge('14-exit', '10-exit', CfgEdge.makeFd())
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
				exitPoints:  [ '12-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 12, type: CfgVertexType.Expression, end: ['12-exit'] })
					.addVertex({ id: '12-exit', type: CfgVertexType.EndMarker, root: 12 })
					.addVertex({ id: 11, type: CfgVertexType.Statement, mid: [0], end: ['11-exit'] })
					.addVertex({ id: '11-exit', type: CfgVertexType.EndMarker, root: 11 })
					.addVertex({ id: 0, type: CfgVertexType.Expression })

					.addVertex({ id: 10, type: CfgVertexType.Expression, end: ['10-exit'] })
					.addVertex({ id: '10-exit', type: CfgVertexType.EndMarker, root: 10 })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: [3], end: ['8-exit'] })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 3, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Expression })
					.addVertex({ id: 6, type: CfgVertexType.Statement })
					.addVertex({ id: 9, type: CfgVertexType.Expression })

					.addEdge(11, 12, CfgEdge.makeFd())
					.addEdge(0, 11, CfgEdge.makeFd())
					.addEdge('11-exit', 0, CfgEdge.makeCdFalse(11))
					.addEdge('12-exit', '11-exit', CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeCdTrue(11))
					.addEdge(8, 10, CfgEdge.makeFd())
					.addEdge(3, 8, CfgEdge.makeFd())
					.addEdge(7, 3, CfgEdge.makeCdTrue(8))
					.addEdge('8-exit', 3, CfgEdge.makeCdFalse(8))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge(11, 6, CfgEdge.makeFd())
					.addEdge(9, '8-exit', CfgEdge.makeFd())
					.addEdge('10-exit', 9, CfgEdge.makeFd())
					.addEdge(11, '10-exit', CfgEdge.makeFd())
			});

			assertCfg(parser, `while (a) {
	if (b) {
		break
	}
	c
}
	`, {
				entryPoints: [ '12' ],
				exitPoints:  [ '12-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 12, type: CfgVertexType.Expression, end: ['12-exit'] })
					.addVertex({ id: '12-exit', type: CfgVertexType.EndMarker, root: 12 })
					.addVertex({ id: 11, type: CfgVertexType.Statement, mid: [0], end: ['11-exit'] })
					.addVertex({ id: '11-exit', type: CfgVertexType.EndMarker, root: 11 })
					.addVertex({ id: 0, type: CfgVertexType.Expression })

					.addVertex({ id: 10, type: CfgVertexType.Expression, end: ['10-exit'] })
					.addVertex({ id: '10-exit', type: CfgVertexType.EndMarker, root: 10 })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: [3], end: ['8-exit'] })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 3, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Expression })
					.addVertex({ id: 6, type: CfgVertexType.Statement })
					.addVertex({ id: 9, type: CfgVertexType.Expression })

					.addEdge(11, 12, CfgEdge.makeFd())
					.addEdge(0, 11, CfgEdge.makeFd())
					.addEdge('11-exit', 0, CfgEdge.makeCdFalse(11))
					.addEdge('12-exit', '11-exit', CfgEdge.makeFd())
					.addEdge(10, 0, CfgEdge.makeCdTrue(11))
					.addEdge(8, 10, CfgEdge.makeFd())
					.addEdge(3, 8, CfgEdge.makeFd())
					.addEdge(7, 3, CfgEdge.makeCdTrue(8))
					.addEdge('8-exit', 3, CfgEdge.makeCdFalse(8))
					.addEdge(6, 7, CfgEdge.makeFd())
					.addEdge('11-exit', 6, CfgEdge.makeFd())
					.addEdge(9, '8-exit', CfgEdge.makeFd())
					.addEdge('10-exit', 9, CfgEdge.makeFd())
					.addEdge(11, '10-exit', CfgEdge.makeFd())
			});
		});

		describe('function calls', () => {
			assertCfg(parser, 'print(x)', {
				entryPoints: [ '4' ],
				exitPoints:  [ '4-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
					.addVertex({ id: 3, type: CfgVertexType.Statement, mid: [0], end: ['3-exit'] })
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 2, type: CfgVertexType.Expression, mid: [2], end: ['2-exit'] })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })

					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(0, 3, CfgEdge.makeFd())
					.addEdge(2, 0, CfgEdge.makeFd())
					.addEdge(1, 2, CfgEdge.makeFd())
					.addEdge('2-exit', 1, CfgEdge.makeFd())
					.addEdge('3-exit', '2-exit', CfgEdge.makeFd())
					.addEdge('4-exit', '3-exit', CfgEdge.makeFd())
			});

			assertCfg(parser, 'f(2 + 3, x=3)', {
				entryPoints: [ '9' ],
				exitPoints:  [ '9-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 8, type: CfgVertexType.Statement, end: ['8-exit'], mid: [0]  })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })

					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'], mid: [4] })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: 2, type: CfgVertexType.Expression })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })

					.addVertex({ id: 7, type: CfgVertexType.Expression, mid: [5], end: ['7-exit'] })
					.addVertex({ id: 5, type: CfgVertexType.Expression })
					.addVertex({ id: 6, type: CfgVertexType.Expression })
					.addVertex({ id: '7-exit', type: CfgVertexType.EndMarker, root: 7 })

					.addVertex({ id: 9, type: CfgVertexType.Expression, end: ['9-exit'] })
					.addVertex({ id: '9-exit', type: CfgVertexType.EndMarker, root: 9 })

					.addEdge(8, 9, CfgEdge.makeFd())
					.addEdge('9-exit', '8-exit', CfgEdge.makeFd())

					.addEdge(0, 8, CfgEdge.makeFd())
					.addEdge(4, 0, CfgEdge.makeFd())
					.addEdge(3, 4, CfgEdge.makeFd())
					.addEdge(1, 3, CfgEdge.makeFd())
					.addEdge(2, 1, CfgEdge.makeFd())
					.addEdge('3-exit', 2, CfgEdge.makeFd())
					.addEdge('4-exit', '3-exit', CfgEdge.makeFd())

					.addEdge(7, '4-exit', CfgEdge.makeFd())
					.addEdge(5, 7, CfgEdge.makeFd())
					.addEdge(6, 5, CfgEdge.makeFd())
					.addEdge('7-exit', 6, CfgEdge.makeFd())
					.addEdge('8-exit', '7-exit', CfgEdge.makeFd())
			});


			assertCfg(parser, 'f <- function(x) x\nf()', {
				entryPoints: [ '9' ],
				exitPoints:  [ '9-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 5, type: CfgVertexType.Expression, mid: [], end: ['5-exit'] })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: [], end: ['8-exit'], callTargets: new Set([5]) })
			}, { expectIsSubgraph: true });

		});
	});
	describe('With Basic Blocks', () => {
		assertCfg(parser, '2 + 3', {
			entryPoints: [ 'bb-3-exit' ],
			exitPoints:  [ 'bb-3-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-3-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 },
						{ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 },
						{ id: 1, type: CfgVertexType.Expression },
						{ id: 0, type: CfgVertexType.Expression },
						{ id: 2, type: CfgVertexType.Expression, end: ['2-exit'] },
						{ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] }
					]
				})
		}, { withBasicBlocks: true });

		assertCfg(parser, 'if(TRUE) {} else {}', {
			entryPoints: ['bb-0'],
			exitPoints:  ['bb-8-exit'],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-0',
					type:  CfgVertexType.Block,
					elems: [
						{ id: 0, type: CfgVertexType.Expression },
						{ id: 7, type: CfgVertexType.Statement, mid: [0], end: ['7-exit'] },
						{ id: 8, type: CfgVertexType.Expression, end: ['8-exit'] }
					]
				})
				.addVertex({
					id:    'bb-3-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 },
						{ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] }
					]
				})
				.addVertex({
					id:    'bb-6-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '6-exit', type: CfgVertexType.EndMarker, root: 6 },
						{ id: 6, type: CfgVertexType.Expression, end: ['6-exit'] }
					]
				})
				.addVertex({
					id:    'bb-8-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 },
						{ id: '7-exit', type: CfgVertexType.EndMarker, root: 7 }
					]
				})
				.addEdge('bb-8-exit', 'bb-3-exit', CfgEdge.makeFd())
				.addEdge('bb-8-exit', 'bb-6-exit', CfgEdge.makeFd())

				.addEdge('bb-3-exit', 'bb-0', CfgEdge.makeCdTrue(7))
				.addEdge('bb-6-exit', 'bb-0', CfgEdge.makeCdFalse(7))
		}, { withBasicBlocks: true });

		assertCfg(parser, 'print(x)', {
			entryPoints: [ 'bb-4-exit' ],
			exitPoints:  [ 'bb-4-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({ id:    'bb-4-exit', type:  CfgVertexType.Block, elems: [
					{ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 },
					{ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 },
					{ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 },
					{ id: 1, type: CfgVertexType.Expression },
					{ id: 2, type: CfgVertexType.Expression, mid: [2], end: ['2-exit'] },
					{ id: 0, type: CfgVertexType.Expression },
					{ id: 3, type: CfgVertexType.Statement, mid: [0], end: ['3-exit'] },
					{ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] }
				] })

		}, { withBasicBlocks: true });

		assertCfg(parser, `while (a) {
	if (b) {
		break
	}
	c
}
	`, {
			entryPoints: [ 'bb-12' ],
			exitPoints:  [ 'bb-12-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-12',
					type:  CfgVertexType.Block,
					elems: [
						{ id: 12, type: CfgVertexType.Expression, end: ['12-exit'] }
					]
				})
				.addVertex({
					id:    'bb-0',
					type:  CfgVertexType.Block,
					elems: [
						{ id: 0, type: CfgVertexType.Expression },
						{ id: 11, type: CfgVertexType.Statement, mid: [0], end: ['11-exit'] }
					]
				})
				.addVertex({
					id:    'bb-10-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '10-exit', type: CfgVertexType.EndMarker, root: 10 },
						{ id: 9, type: CfgVertexType.Expression },
						{ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 }
					]
				})
				.addVertex({
					id:    'bb-3',
					type:  CfgVertexType.Block,
					elems: [
						{ id: 3, type: CfgVertexType.Expression },
						{ id: 8, type: CfgVertexType.Statement, mid: [3], end: ['8-exit'] },
						{ id: 10, type: CfgVertexType.Expression, end: ['10-exit'] }
					]
				})
				.addVertex({
					id:    'bb-6',
					type:  CfgVertexType.Block,
					elems: [
						{ id: 6, type: CfgVertexType.Statement },
						{ id: 7, type: CfgVertexType.Expression }
					]
				})
				.addVertex({
					id:    'bb-12-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '12-exit', type: CfgVertexType.EndMarker, root: 12 },
						{ id: '11-exit', type: CfgVertexType.EndMarker, root: 11 }
					]
				})

				.addEdge('bb-0', 'bb-12', CfgEdge.makeFd())
				.addEdge('bb-0', 'bb-10-exit', CfgEdge.makeFd())

				.addEdge('bb-10-exit', 'bb-3', CfgEdge.makeCdFalse(8))
				.addEdge('bb-3', 'bb-0', CfgEdge.makeCdTrue(11))
				.addEdge('bb-6', 'bb-3', CfgEdge.makeCdTrue(8))
				.addEdge('bb-12-exit', 'bb-0', CfgEdge.makeCdFalse(11))
				.addEdge('bb-12-exit', 'bb-6', CfgEdge.makeFd())

		}, { withBasicBlocks: true });

		assertCfg(parser, 'f <- function(x) x\nf()', {
			entryPoints: ['bb-5'],
			exitPoints:  ['bb-9-exit'],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-8-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 },
						{ id: 7, type: CfgVertexType.Expression },
						{
							id:          8,
							type:        CfgVertexType.Statement,
							mid:         [0],
							end:         ['8-exit'],
							callTargets: new Set([5])
						},
						{ id: '6-exit', type: CfgVertexType.EndMarker, root: 6 }

					]
				})
		}, { expectIsSubgraph: true, withBasicBlocks: true });
	});
}));
