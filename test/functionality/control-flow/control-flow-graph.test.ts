import { withTreeSitter } from '../_helper/shell';
import { RFalse, RTrue } from '../../../src/r-bridge/lang-4.x/convert-values';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/controlflow/assert-control-flow-graph';
import { CfgEdgeType, CfgVertexType, ControlFlowGraph } from '../../../src/control-flow/control-flow-graph';

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

				.addEdge(2, 3, { label: CfgEdgeType.Fd })
				.addEdge(0, 2, { label: CfgEdgeType.Fd })
				.addEdge(1, 0, { label: CfgEdgeType.Fd })
				.addEdge('2-exit', 1, { label: CfgEdgeType.Fd })
				.addEdge('3-exit', '2-exit', { label: CfgEdgeType.Fd })
		});

		assertCfg(parser, 'df$name', {
			entryPoints: [ '4' ],
			exitPoints:  [ '4-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
				.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
				.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'], mid: ['3-after-name'] })
				.addVertex({ id: '3-after-name', kind: 'after-name', type: CfgVertexType.MidMarker, root: 3 })
				.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
				.addVertex({ id: 2, type: CfgVertexType.Expression, end: ['2-exit'], mid: ['2-before-value'] })
				.addVertex({ id: '2-before-value', kind: 'before-value', type: CfgVertexType.MidMarker, root: 2 })
				.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
				.addVertex({ id: 0, type: CfgVertexType.Expression })
				.addVertex({ id: 1, type: CfgVertexType.Expression })
				.addEdge(3, 4, { label: CfgEdgeType.Fd })
				.addEdge(0, 3, { label: CfgEdgeType.Fd })
				.addEdge('3-after-name', 0, { label: CfgEdgeType.Fd })
				.addEdge(2, '3-after-name', { label: CfgEdgeType.Fd })
				.addEdge('2-before-value', 2, { label: CfgEdgeType.Fd })
				.addEdge(1, '2-before-value', { label: CfgEdgeType.Fd })
				.addEdge('2-exit', 1, { label: CfgEdgeType.Fd })
				.addEdge('3-exit', '2-exit', { label: CfgEdgeType.Fd })
				.addEdge('4-exit', '3-exit', { label: CfgEdgeType.Fd })
		});

		describe('conditionals', () => {
			assertCfg(parser, 'if(TRUE) 1', {
				entryPoints: [ '4' ],
				exitPoints:  [ '4-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: 3, type: CfgVertexType.Statement, mid: ['3-condition'], end: ['3-exit'] })
					.addVertex({ id: '3-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 3 })
					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
					.addVertex({ id: 2, type: CfgVertexType.Expression, end: ['2-exit'] })
					.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(3, 4, { label: CfgEdgeType.Fd })
					.addEdge(0, 3, { label: CfgEdgeType.Fd })
					.addEdge(1, 2, { label: CfgEdgeType.Fd })
					.addEdge('2-exit', 1, { label: CfgEdgeType.Fd })
					.addEdge('3-exit', '2-exit', { label: CfgEdgeType.Fd })
					.addEdge('3-condition', 0, { label: CfgEdgeType.Fd })
					.addEdge(2, '3-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 3 })
					.addEdge('3-exit', '3-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 3 })
					.addEdge('4-exit', '3-exit', { label: CfgEdgeType.Fd })
			});

			assertCfg(parser, 'if(TRUE) {}', {
				entryPoints: [ '5' ],
				exitPoints:  [ '5-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 4, type: CfgVertexType.Statement, mid: ['4-condition'], end: ['4-exit'] })
					.addVertex({ id: '4-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 4 })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })
					.addVertex({ id: 5, type: CfgVertexType.Expression, end: ['5-exit'] })
					.addVertex({ id: '5-exit', type: CfgVertexType.EndMarker, root: 5 })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(4, 5, { label: CfgEdgeType.Fd })
					.addEdge(0, 4, { label: CfgEdgeType.Fd })
					.addEdge('4-condition', 0, { label: CfgEdgeType.Fd })
					.addEdge(3, '4-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 4 })
					.addEdge('3-exit', 3, { label: CfgEdgeType.Fd })
					.addEdge('4-exit', '3-exit', { label: CfgEdgeType.Fd })
					.addEdge('4-exit', '4-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 4 })
					.addEdge('5-exit', '4-exit', { label: CfgEdgeType.Fd })
			});

			assertCfg(parser, 'if(TRUE) {} else {}', {
				entryPoints: [ '8' ],
				exitPoints:  [ '8-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Statement, mid: ['7-condition'], end: ['7-exit'] })
					.addVertex({ id: '7-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 7 })
					.addVertex({ id: '7-exit', type: CfgVertexType.EndMarker, root: 7 })
					.addVertex({ id: 8, type: CfgVertexType.Expression, end: ['8-exit'] })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 6, type: CfgVertexType.Expression, end: ['6-exit'] })
					.addVertex({ id: '6-exit', type: CfgVertexType.EndMarker, root: 6 })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addEdge(7, 8, { label: CfgEdgeType.Fd })
					.addEdge(0, 7, { label: CfgEdgeType.Fd })
					.addEdge('7-condition', 0, { label: CfgEdgeType.Fd })

					.addEdge(3, '7-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 7 })
					.addEdge(6, '7-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 7 })

					.addEdge('3-exit', 3, { label: CfgEdgeType.Fd })
					.addEdge('6-exit', 6, { label: CfgEdgeType.Fd })

					.addEdge('7-exit', '3-exit', { label: CfgEdgeType.Fd })
					.addEdge('7-exit', '6-exit', { label: CfgEdgeType.Fd })
					.addEdge('8-exit', '7-exit', { label: CfgEdgeType.Fd })
			});
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
					.addVertex({ id: 11, type: CfgVertexType.Statement, mid: ['11-condition'], end: ['11-exit'] })
					.addVertex({ id: '11-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 11 })
					.addVertex({ id: '11-exit', type: CfgVertexType.EndMarker, root: 11 })
					.addVertex({ id: 0, type: CfgVertexType.Expression })

					.addVertex({ id: 10, type: CfgVertexType.Expression, end: ['10-exit'] })
					.addVertex({ id: '10-exit', type: CfgVertexType.EndMarker, root: 10 })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: ['8-condition'], end: ['8-exit'] })
					.addVertex({ id: '8-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 8 })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 3, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Expression })
					.addVertex({ id: 6, type: CfgVertexType.Statement })
					.addVertex({ id: 9, type: CfgVertexType.Expression })

					.addEdge(11, 12, { label: CfgEdgeType.Fd })
					.addEdge(0, 11, { label: CfgEdgeType.Fd })
					.addEdge('11-condition', 0, { label: CfgEdgeType.Fd })
					.addEdge('11-exit', '11-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 11 })
					.addEdge('12-exit', '11-exit', { label: CfgEdgeType.Fd })
					.addEdge(10, '11-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 11 })
					.addEdge(8, 10, { label: CfgEdgeType.Fd })
					.addEdge(3, 8, { label: CfgEdgeType.Fd })
					.addEdge('8-condition', 3, { label: CfgEdgeType.Fd })
					.addEdge(7, '8-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 8 })
					.addEdge('8-exit', '8-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 8 })
					.addEdge(6, 7, { label: CfgEdgeType.Fd })
					.addEdge(11, 6, { label: CfgEdgeType.Fd })
					.addEdge(9, '8-exit', { label: CfgEdgeType.Fd })
					.addEdge('10-exit', 9, { label: CfgEdgeType.Fd })
					.addEdge(11, '10-exit', { label: CfgEdgeType.Fd })
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
					.addVertex({ id: 11, type: CfgVertexType.Statement, mid: ['11-condition'], end: ['11-exit'] })
					.addVertex({ id: '11-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 11 })
					.addVertex({ id: '11-exit', type: CfgVertexType.EndMarker, root: 11 })
					.addVertex({ id: 0, type: CfgVertexType.Expression })

					.addVertex({ id: 10, type: CfgVertexType.Expression, end: ['10-exit'] })
					.addVertex({ id: '10-exit', type: CfgVertexType.EndMarker, root: 10 })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: ['8-condition'], end: ['8-exit'] })
					.addVertex({ id: '8-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 8 })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })
					.addVertex({ id: 3, type: CfgVertexType.Expression })
					.addVertex({ id: 7, type: CfgVertexType.Expression })
					.addVertex({ id: 6, type: CfgVertexType.Statement })
					.addVertex({ id: 9, type: CfgVertexType.Expression })

					.addEdge(11, 12, { label: CfgEdgeType.Fd })
					.addEdge(0, 11, { label: CfgEdgeType.Fd })
					.addEdge('11-condition', 0, { label: CfgEdgeType.Fd })
					.addEdge('11-exit', '11-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 11 })
					.addEdge('12-exit', '11-exit', { label: CfgEdgeType.Fd })
					.addEdge(10, '11-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 11 })
					.addEdge(8, 10, { label: CfgEdgeType.Fd })
					.addEdge(3, 8, { label: CfgEdgeType.Fd })
					.addEdge('8-condition', 3, { label: CfgEdgeType.Fd })
					.addEdge(7, '8-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 8 })
					.addEdge('8-exit', '8-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 8 })
					.addEdge(6, 7, { label: CfgEdgeType.Fd })
					.addEdge('11-exit', 6, { label: CfgEdgeType.Fd })
					.addEdge(9, '8-exit', { label: CfgEdgeType.Fd })
					.addEdge('10-exit', 9, { label: CfgEdgeType.Fd })
					.addEdge(11, '10-exit', { label: CfgEdgeType.Fd })
			});
		});

		describe('function calls', () => {
			assertCfg(parser, 'print(x)', {
				entryPoints: [ '4' ],
				exitPoints:  [ '4-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'] })
					.addVertex({ id: 3, type: CfgVertexType.Statement, mid: ['3-name'], end: ['3-exit'] })
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 2, type: CfgVertexType.Expression, mid: ['2-before-value'], end: ['2-exit'] })
					.addVertex({ id: '3-name', type: CfgVertexType.MidMarker, kind: 'name', root: 3 })
					.addVertex({ id: '2-before-value', type: CfgVertexType.MidMarker, kind: 'before-value', root: 2 })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: '2-exit', type: CfgVertexType.EndMarker, root: 2 })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })

					.addEdge(3, 4, { label: CfgEdgeType.Fd })
					.addEdge(0, 3, { label: CfgEdgeType.Fd })
					.addEdge('3-name', 0, { label: CfgEdgeType.Fd })
					.addEdge(2, '3-name', { label: CfgEdgeType.Fd })
					.addEdge('2-before-value', 2, { label: CfgEdgeType.Fd })
					.addEdge(1, '2-before-value', { label: CfgEdgeType.Fd })
					.addEdge('2-exit', 1, { label: CfgEdgeType.Fd })
					.addEdge('3-exit', '2-exit', { label: CfgEdgeType.Fd })
					.addEdge('4-exit', '3-exit', { label: CfgEdgeType.Fd })
			});

			assertCfg(parser, 'f(2 + 3, x=3)', {
				entryPoints: [ '9' ],
				exitPoints:  [ '9-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 0, type: CfgVertexType.Expression })
					.addVertex({ id: 8, type: CfgVertexType.Statement, end: ['8-exit'], mid: ['8-name']  })
					.addVertex({ id: '8-name', kind: 'name', type: CfgVertexType.MidMarker, root: 8 })
					.addVertex({ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 })

					.addVertex({ id: 4, type: CfgVertexType.Expression, end: ['4-exit'], mid: ['4-before-value'] })
					.addVertex({ id: '4-before-value', kind: 'before-value', type: CfgVertexType.MidMarker, root: 4 })
					.addVertex({ id: 1, type: CfgVertexType.Expression })
					.addVertex({ id: 2, type: CfgVertexType.Expression })
					.addVertex({ id: 3, type: CfgVertexType.Expression, end: ['3-exit'] })
					.addVertex({ id: '3-exit', type: CfgVertexType.EndMarker, root: 3 })
					.addVertex({ id: '4-exit', type: CfgVertexType.EndMarker, root: 4 })

					.addVertex({ id: 7, type: CfgVertexType.Expression, mid: ['7-before-value'], end: ['7-exit'] })
					.addVertex({ id: 5, type: CfgVertexType.Expression })
					.addVertex({ id: '7-before-value', kind: 'before-value', type: CfgVertexType.MidMarker, root: 7 })
					.addVertex({ id: 6, type: CfgVertexType.Expression })
					.addVertex({ id: '7-exit', type: CfgVertexType.EndMarker, root: 7 })

					.addVertex({ id: 9, type: CfgVertexType.Expression, end: ['9-exit'] })
					.addVertex({ id: '9-exit', type: CfgVertexType.EndMarker, root: 9 })

					.addEdge(8, 9, { label: CfgEdgeType.Fd })
					.addEdge('9-exit', '8-exit', { label: CfgEdgeType.Fd })

					.addEdge(0, 8, { label: CfgEdgeType.Fd })
					.addEdge('8-name', 0, { label: CfgEdgeType.Fd })
					.addEdge(4, '8-name', { label: CfgEdgeType.Fd })
					.addEdge('4-before-value', 4, { label: CfgEdgeType.Fd })
					.addEdge(3, '4-before-value', { label: CfgEdgeType.Fd })
					.addEdge(1, 3, { label: CfgEdgeType.Fd })
					.addEdge(2, 1, { label: CfgEdgeType.Fd })
					.addEdge('3-exit', 2, { label: CfgEdgeType.Fd })
					.addEdge('4-exit', '3-exit', { label: CfgEdgeType.Fd })

					.addEdge(7, '4-exit', { label: CfgEdgeType.Fd })
					.addEdge(5, 7, { label: CfgEdgeType.Fd })
					.addEdge('7-before-value', 5, { label: CfgEdgeType.Fd })
					.addEdge(6, '7-before-value', { label: CfgEdgeType.Fd })
					.addEdge('7-exit', 6, { label: CfgEdgeType.Fd })
					.addEdge('8-exit', '7-exit', { label: CfgEdgeType.Fd })
			});


			assertCfg(parser, 'f <- function(x) x\nf()', {
				entryPoints: [ '9' ],
				exitPoints:  [ '9-exit' ],
				graph:       new ControlFlowGraph()
					.addVertex({ id: 5, type: CfgVertexType.Expression, mid: ['5-params'], end: ['5-exit'] })
					.addVertex({ id: 8, type: CfgVertexType.Statement, mid: ['8-name'], end: ['8-exit'], callTargets: new Set([5]) })
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
			entryPoints: [ 'bb-7-condition' ],
			exitPoints:  [ 'bb-8-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-7-condition',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '7-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 7 },
						{ id: 0, type: CfgVertexType.Expression },
						{ id: 7, type: CfgVertexType.Statement, mid: ['7-condition'], end: ['7-exit'] },
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
				.addEdge('bb-8-exit', 'bb-3-exit', { label: CfgEdgeType.Fd })
				.addEdge('bb-8-exit', 'bb-6-exit', { label: CfgEdgeType.Fd })

				.addEdge('bb-3-exit', 'bb-7-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 7 })
				.addEdge('bb-6-exit', 'bb-7-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 7 })
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
					{ id: '2-before-value', type: CfgVertexType.MidMarker, kind: 'before-value', root: 2 },
					{ id: 2, type: CfgVertexType.Expression, mid: ['2-before-value'], end: ['2-exit'] },
					{ id: '3-name', type: CfgVertexType.MidMarker, kind: 'name', root: 3 },
					{ id: 0, type: CfgVertexType.Expression },
					{ id: 3, type: CfgVertexType.Statement, mid: ['3-name'], end: ['3-exit'] },
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
					id:    'bb-11-condition',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '11-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 11 },
						{ id: 0, type: CfgVertexType.Expression },
						{ id: 11, type: CfgVertexType.Statement, mid: ['11-condition'], end: ['11-exit'] }
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
					id:    'bb-8-condition',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '8-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: 8 },
						{ id: 3, type: CfgVertexType.Expression },
						{ id: 8, type: CfgVertexType.Statement, mid: ['8-condition'], end: ['8-exit'] },
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

				.addEdge('bb-11-condition', 'bb-12', { label: CfgEdgeType.Fd })
				.addEdge('bb-11-condition', 'bb-10-exit', { label: CfgEdgeType.Fd })

				.addEdge('bb-10-exit', 'bb-8-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 8 })
				.addEdge('bb-8-condition', 'bb-11-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 11 })
				.addEdge('bb-6', 'bb-8-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: 8 })
				.addEdge('bb-12-exit', 'bb-11-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: 11 })
				.addEdge('bb-12-exit', 'bb-6', { label: CfgEdgeType.Fd })

		}, { withBasicBlocks: true });

		assertCfg(parser, 'f <- function(x) x\nf()', {
			entryPoints: [ 'bb-5' ],
			exitPoints:  [ 'bb-9-exit' ],
			graph:       new ControlFlowGraph()
				.addVertex({
					id:    'bb-8-exit',
					type:  CfgVertexType.Block,
					elems: [
						{ id: '8-exit', type: CfgVertexType.EndMarker, root: 8 },
						{ id: '8-name', kind: 'name', type: CfgVertexType.MidMarker, root: 8 },
						{ id: 7, type: CfgVertexType.Expression },
						{ id: 8, type: CfgVertexType.Statement, mid: ['8-name'], end: ['8-exit'], callTargets: new Set([5]) },
						{ id: '6-exit', type: CfgVertexType.EndMarker, root: 6 }

					]
				})
		}, { expectIsSubgraph: true, withBasicBlocks: true });
	});
	// TODO: test fg and ast mermaid rendering
	// TODO: latex renderers for the cfg and ast
	// TODO: origin function as described
	// TODO: visitor
}));
