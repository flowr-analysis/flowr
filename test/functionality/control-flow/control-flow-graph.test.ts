import { withTreeSitter } from '../_helper/shell';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { RFalse, RTrue } from '../../../src/r-bridge/lang-4.x/convert-values';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/control-flow';
import { CfgVertexType, ControlFlowGraph } from '../../../src/control-flow/control-flow-graph';

describe('Control Flow Graph', withTreeSitter(parser => {
	assertCfg(parser, 'if(TRUE) 1', {
		entryPoints: [ '4' ],
		exitPoints:  [ '4-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Logical, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.IfThenElse, type: CfgVertexType.Statement })
			.addVertex({ id: 4, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '4-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 4 })
			.addVertex({ id: 2, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '2-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 2 })
			.addVertex({ id: '3-exit', name: 'if-exit', type: CfgVertexType.EndMarker, root: 3 })
			.addEdge(3, 4, { label: 'FD' })
			.addEdge(0, 3, { label: 'FD' })
			.addEdge(1, 2, { label: 'FD' })
			.addEdge('2-exit', 1, { label: 'FD' })
			.addEdge('3-exit', '2-exit', { label: 'FD' })
			.addEdge(2, 0, { label: 'CD', when: RTrue, caused: 3 })
			.addEdge('3-exit', 0, { label: 'CD', when: RFalse, caused: 3 })
			.addEdge('4-exit', '3-exit', { label: 'FD' })
	});

	assertCfg(parser, 'if(TRUE) {}', {
		entryPoints: [ '5' ],
		exitPoints:  [ '5-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Logical, type: CfgVertexType.Expression })
			.addVertex({ id: 4, name: RType.IfThenElse, type: CfgVertexType.Statement })
			.addVertex({ id: '4-exit', name: 'if-exit', type: CfgVertexType.EndMarker, root: 4 })
			.addVertex({ id: 5, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '5-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 5 })
			.addVertex({ id: 3, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 3 })
			.addEdge(4, 5, { label: 'FD' })
			.addEdge(0, 4, { label: 'FD' })
			.addEdge(3, 0, { label: 'CD', when: RTrue, caused: 4 })
			.addEdge('3-exit', 3, { label: 'FD' })
			.addEdge('4-exit', '3-exit', { label: 'FD' })
			.addEdge('4-exit', 0, { label: 'CD', when: RFalse, caused: 4 })
			.addEdge('5-exit', '4-exit', { label: 'FD' })
	});

	assertCfg(parser, 'if(TRUE) {} else {}', {
		entryPoints: [ '8' ],
		exitPoints:  [ '8-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Logical, type: CfgVertexType.Expression })
			.addVertex({ id: 7, name: RType.IfThenElse, type: CfgVertexType.Statement })
			.addVertex({ id: '7-exit', name: 'if-exit', type: CfgVertexType.EndMarker, root: 7 })
			.addVertex({ id: 8, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '8-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 8 })
			.addVertex({ id: 6, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '6-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 6 })
			.addVertex({ id: 3, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 3 })
			.addEdge(7, 8, { label: 'FD' })
			.addEdge(0, 7, { label: 'FD' })

			.addEdge(3, 0, { label: 'CD', when: RTrue, caused: 7 })
			.addEdge(6, 0, { label: 'CD', when: RFalse, caused: 7 })

			.addEdge('3-exit', 3, { label: 'FD' })
			.addEdge('6-exit', 6, { label: 'FD' })

			.addEdge('7-exit', '3-exit', { label: 'FD' })
			.addEdge('7-exit', '6-exit', { label: 'FD' })
			.addEdge('8-exit', '7-exit', { label: 'FD' })
	});

	assertCfg(parser, '2 + 3', {
		entryPoints: [ '3' ],
		exitPoints:  [ '3-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '2-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker, root: 2 })
			.addVertex({ id: 3, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 3 })

			.addEdge(2, 3, { label: 'FD' })
			.addEdge(0, 2, { label: 'FD' })
			.addEdge(1, 0, { label: 'FD' })
			.addEdge('2-exit', 1, { label: 'FD' })
			.addEdge('3-exit', '2-exit', { label: 'FD' })
	});

	assertCfg(parser, 'df$name', {
		entryPoints: [ '4' ],
		exitPoints:  [ '4-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 4, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '4-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 4 })
			.addVertex({ id: 3, name: RType.Access, type: CfgVertexType.Expression })
			.addVertex({ id: '3-after-name', name: RType.Access, type: CfgVertexType.MidMarker, root: 3 })
			.addVertex({ id: '3-exit', name: 'access-exit', type: CfgVertexType.EndMarker, root: 3 })
			.addVertex({ id: 2, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: '2-before-value', name: 'before-value', type: CfgVertexType.MidMarker, root: 2 })
			.addVertex({ id: '2-exit', name: 'exit', type: CfgVertexType.EndMarker, root: 2 })
			.addVertex({ id: 0, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Symbol, type: CfgVertexType.Expression })
			.addEdge(3, 4, { label: 'FD' })
			.addEdge(0, 3, { label: 'FD' })
			.addEdge('3-after-name', 0, { label: 'FD' })
			.addEdge(2, '3-after-name', { label: 'FD' })
			.addEdge('2-before-value', 2, { label: 'FD' })
			.addEdge(1, '2-before-value', { label: 'FD' })
			.addEdge('2-exit', 1, { label: 'FD' })
			.addEdge('3-exit', '2-exit', { label: 'FD' })
			.addEdge('4-exit', '3-exit', { label: 'FD' })
	});

	assertCfg(parser, 'f(2 + 3, x=3)', {
		entryPoints: [ '9' ],
		exitPoints:  [ '9-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: 8, name: RType.FunctionCall, type: CfgVertexType.Statement  })
			.addVertex({ id: '8-name', name: 'call-name', type: CfgVertexType.MidMarker, root: 8 })
			.addVertex({ id: '8-exit', name: 'call-exit', type: CfgVertexType.EndMarker, root: 8 })

			.addVertex({ id: 4, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: '4-before-value', name: 'before-value', type: CfgVertexType.MidMarker, root: 4 })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker, root: 3 })
			.addVertex({ id: '4-exit', name: 'exit', type: CfgVertexType.EndMarker, root: 4 })

			.addVertex({ id: 7, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: 5, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: '7-before-value', name: 'before-value', type: CfgVertexType.MidMarker, root: 7 })
			.addVertex({ id: 6, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: '7-exit', name: 'exit', type: CfgVertexType.EndMarker, root: 7 })

			.addVertex({ id: 9, name: RType.ExpressionList, type: CfgVertexType.Expression })
			.addVertex({ id: '9-exit', name: RType.ExpressionList, type: CfgVertexType.EndMarker, root: 9 })

			.addEdge(8, 9, { label: 'FD' })
			.addEdge('9-exit', '8-exit', { label: 'FD' })

			.addEdge(0, 8, { label: 'FD' })
			.addEdge('8-name', 0, { label: 'FD' })
			.addEdge(4, '8-name', { label: 'FD' })
			.addEdge('4-before-value', 4, { label: 'FD' })
			.addEdge(3, '4-before-value', { label: 'FD' })
			.addEdge(1, 3, { label: 'FD' })
			.addEdge(2, 1, { label: 'FD' })
			.addEdge('3-exit', 2, { label: 'FD' })
			.addEdge('4-exit', '3-exit', { label: 'FD' })

			.addEdge(7, '4-exit', { label: 'FD' })
			.addEdge(5, 7, { label: 'FD' })
			.addEdge('7-before-value', 5, { label: 'FD' })
			.addEdge(6, '7-before-value', { label: 'FD' })
			.addEdge('7-exit', 6, { label: 'FD' })
			.addEdge('8-exit', '7-exit', { label: 'FD' })
	});
}));
