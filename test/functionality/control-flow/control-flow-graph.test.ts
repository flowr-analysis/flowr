import { withTreeSitter } from '../_helper/shell';
import {
	CfgVertexType,
	ControlFlowGraph
} from '../../../src/control-flow/cfg';

import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { RFalse, RTrue } from '../../../src/r-bridge/lang-4.x/convert-values';
import { describe } from 'vitest';
import { assertCfg } from '../_helper/control-flow';

describe('Control Flow Graph', withTreeSitter(parser => {
	assertCfg(parser, 'if(TRUE) 1', {
		entryPoints: [ '3' ],
		exitPoints:  [ '3-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Logical, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.IfThenElse, type: CfgVertexType.Statement })
			.addVertex({ id: '3-exit', name: 'if-exit', type: CfgVertexType.EndMarker })
			.addEdge(0, 3, { label: 'FD' })
			.addEdge(1, 0, { label: 'CD', when: RTrue, caused: 3 })
			.addEdge('3-exit', 1, { label: 'FD' })
			.addEdge('3-exit', 0, { label: 'CD', when: RFalse, caused: 3 })
	});

	assertCfg(parser, '2 + 3', {
		entryPoints: [ '2' ],
		exitPoints:  [ '2-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '2-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker })
			.addEdge(0, 2, { label: 'FD' })
			.addEdge(1, 0, { label: 'FD' })
			.addEdge('2-exit', 1, { label: 'FD' })
	});

	assertCfg(parser, 'f(2 + 3, x=3)', {
		entryPoints: [ '8' ],
		exitPoints:  [ '8-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: 8, name: RType.FunctionCall, type: CfgVertexType.Statement  })
			.addVertex({ id: '8-name', name: 'call-name', type: CfgVertexType.MidMarker })
			.addVertex({ id: '8-exit', name: 'call-exit', type: CfgVertexType.EndMarker })

			.addVertex({ id: 4, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: '4-before-value', name: 'before-value', type: CfgVertexType.MidMarker })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker })
			.addVertex({ id: '4-exit', name: 'exit', type: CfgVertexType.EndMarker })

			.addVertex({ id: 7, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: 5, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: '7-before-value', name: 'before-value', type: CfgVertexType.MidMarker })
			.addVertex({ id: 6, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: '7-exit', name: 'exit', type: CfgVertexType.EndMarker })

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
