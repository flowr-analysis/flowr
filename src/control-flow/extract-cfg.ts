import type { QuadSerializationConfiguration } from '../util/quads';
import { graph2quads } from '../util/quads';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FoldFunctions } from '../r-bridge/lang-4.x/ast/model/processing/fold';
import { foldAst } from '../r-bridge/lang-4.x/ast/model/processing/fold';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { getAllFunctionCallTargets } from '../dataflow/internal/linker';
import { isFunctionDefinitionVertex } from '../dataflow/graph/vertex';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { ControlFlowInformation } from './control-flow-graph';
import { CfgVertexType, ControlFlowGraph } from './control-flow-graph';


const cfgFolds: FoldFunctions<ParentInformation, ControlFlowInformation> = {
	foldNumber:   cfgLeaf(CfgVertexType.Expression),
	foldString:   cfgLeaf(CfgVertexType.Expression),
	foldLogical:  cfgLeaf(CfgVertexType.Expression),
	foldSymbol:   cfgLeaf(CfgVertexType.Expression),
	foldAccess:   cfgAccess,
	foldBinaryOp: cfgBinaryOp,
	foldPipe:     cfgBinaryOp,
	foldUnaryOp:  cfgUnaryOp,
	other:        {
		foldComment:       cfgIgnore,
		foldLineDirective: cfgIgnore
	},
	loop: {
		foldFor:    cfgFor,
		foldRepeat: cfgRepeat,
		foldWhile:  cfgWhile,
		foldBreak:  cfgBreak,
		foldNext:   cfgNext
	},
	foldIfThenElse: cfgIfThenElse,
	foldExprList:   cfgExprList,
	functions:      {
		foldFunctionDefinition: cfgFunctionDefinition,
		foldFunctionCall:       cfgFunctionCall,
		foldParameter:          cfgArgumentOrParameter,
		foldArgument:           cfgArgumentOrParameter
	}
};

function dataflowCfgFolds(dataflowGraph: DataflowGraph): FoldFunctions<ParentInformation, ControlFlowInformation> {
	return {
		...cfgFolds,
		functions: {
			...cfgFolds.functions,
			foldFunctionCall: cfgFunctionCallWithDataflow(dataflowGraph)
		}
	};
}

/**
 * Given a normalized AST this approximates the control flow graph of the program.
 * This few is different from the computation of the dataflow graph and may differ,
 * especially because it focuses on intra-procedural analysis.
 *
 * @param ast - the normalized AST
 * @param graph - additional dataflow facts to consider by the control flow extraction
 */
export function extractCFG<Info=ParentInformation>(
	ast:    NormalizedAst<Info>,
	graph?: DataflowGraph
): ControlFlowInformation {
	return foldAst(ast.ast, graph ? dataflowCfgFolds(graph) : cfgFolds);
}

function cfgLeaf(type: CfgVertexType.Expression | CfgVertexType.Statement): (leaf: RNodeWithParent) => ControlFlowInformation {
	return (leaf: RNodeWithParent) => {
		const graph = new ControlFlowGraph();
		graph.addVertex({ id: leaf.info.id, name: leaf.type, type });
		return { graph, breaks: [], nexts: [], returns: [], exitPoints: [leaf.info.id], entryPoints: [leaf.info.id] };
	};
}

function cfgBreak(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(CfgVertexType.Statement)(leaf), breaks: [leaf.info.id], exitPoints: [] };
}

function cfgNext(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(CfgVertexType.Statement)(leaf), nexts: [leaf.info.id], exitPoints: [] };
}

function cfgIgnore(_leaf: RNodeWithParent): ControlFlowInformation {
	return { graph: new ControlFlowGraph(), breaks: [], nexts: [], returns: [], exitPoints: [], entryPoints: [] };
}

function identifyMayStatementType(node: RNodeWithParent) {
	return node.info.role === RoleInParent.ExpressionListChild ? CfgVertexType.Statement : CfgVertexType.Expression;
}

function cfgIfThenElse(ifNode: RNodeWithParent, condition: ControlFlowInformation, then: ControlFlowInformation, otherwise: ControlFlowInformation | undefined): ControlFlowInformation {
	const graph = new ControlFlowGraph();
	graph.addVertex({ id: ifNode.info.id, name: ifNode.type, type: identifyMayStatementType(ifNode) });
	graph.addVertex({ id: ifNode.info.id + '-exit', name: 'if-exit', type: CfgVertexType.EndMarker, root: ifNode.info.id });
	graph.merge(condition.graph);
	graph.merge(then.graph);
	if(otherwise) {
		graph.merge(otherwise.graph);
	}

	for(const exitPoint of condition.exitPoints) {
		for(const entryPoint of then.entryPoints) {
			graph.addEdge(entryPoint, exitPoint, { label: 'CD', when: RTrue, caused: ifNode.info.id });
		}
		for(const entryPoint of otherwise?.entryPoints ?? []) {
			graph.addEdge(entryPoint, exitPoint, { label: 'CD', when: RFalse, caused: ifNode.info.id });
		}
	}
	for(const entryPoint of condition.entryPoints) {
		graph.addEdge(entryPoint, ifNode.info.id, { label: 'FD' });
	}

	for(const exit of [...then.exitPoints, ...otherwise?.exitPoints ?? []]) {
		graph.addEdge(ifNode.info.id + '-exit', exit, { label: 'FD' });
	}
	if(!otherwise) {
		for(const exitPoint of condition.exitPoints) {
			graph.addEdge(ifNode.info.id + '-exit', exitPoint, { label: 'CD', when: RFalse, caused: ifNode.info.id });
		}
	}

	return {
		graph,
		breaks:      [...then.breaks, ...otherwise?.breaks ?? []],
		nexts:       [...then.nexts, ...otherwise?.nexts ?? []],
		returns:     [...then.returns, ...otherwise?.returns ?? []],
		exitPoints:  [ifNode.info.id + '-exit'],
		entryPoints: [ifNode.info.id]
	};
}

function cfgRepeat(repeat: RRepeatLoop<ParentInformation>, body: ControlFlowInformation): ControlFlowInformation {
	const graph = body.graph;
	graph.addVertex({ id: repeat.info.id, name: repeat.type, type: identifyMayStatementType(repeat) });
	graph.addVertex({ id: repeat.info.id + '-exit', name: 'repeat-exit', type: CfgVertexType.EndMarker, root: repeat.info.id });

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(entryPoint, repeat.info.id, { label: 'FD' });
	}

	// loops automatically
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(repeat.info.id, next, { label: 'FD' });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(repeat.info.id + '-exit', breakPoint, { label: 'FD' });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [repeat.info.id + '-exit'], entryPoints: [repeat.info.id] };
}

function cfgWhile(whileLoop: RWhileLoop<ParentInformation>, condition: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const graph = condition.graph;
	graph.addVertex({ id: whileLoop.info.id, name: whileLoop.type, type: identifyMayStatementType(whileLoop) });
	graph.addVertex({ id: whileLoop.info.id + '-exit', name: 'while-exit', type: CfgVertexType.EndMarker, root: whileLoop.info.id });

	graph.merge(body.graph);

	for(const entry of condition.entryPoints) {
		graph.addEdge(entry, whileLoop.info.id, { label: 'FD' });
	}

	for(const exit of condition.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, exit, { label: 'CD', when: RTrue, caused: whileLoop.info.id });
		}
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(whileLoop.info.id, next, { label: 'FD' });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(whileLoop.info.id + '-exit', breakPoint, { label: 'FD' });
	}
	// while can break on the condition as well
	for(const exit of condition.exitPoints) {
		graph.addEdge(whileLoop.info.id + '-exit', exit, { label: 'CD', when: RFalse, caused: whileLoop.info.id  });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [whileLoop.info.id + '-exit'], entryPoints: [whileLoop.info.id] };
}


function cfgFor(forLoop: RForLoop<ParentInformation>, variable: ControlFlowInformation, vector: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const graph = variable.graph;
	graph.addVertex({ id: forLoop.info.id, name: forLoop.type, type: identifyMayStatementType(forLoop) });

	graph.merge(vector.graph);
	graph.merge(body.graph);

	for(const entry of vector.entryPoints) {
		graph.addEdge(entry, forLoop.info.id, { label: 'FD' });
	}

	for(const exit of vector.exitPoints) {
		for(const entry of variable.entryPoints) {
			graph.addEdge(entry, exit, { label: 'FD' });
		}
	}

	for(const exit of variable.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, exit, { label: 'CD', when: RTrue, caused: forLoop.info.id });
		}
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(forLoop.info.id, next, { label: 'FD' });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(forLoop.info.id + '-exit', breakPoint, { label: 'FD' });
	}

	if(body.exitPoints.length > 0) {
		graph.addVertex({
			id:   forLoop.info.id + '-exit',
			name: 'for-exit',
			type: CfgVertexType.EndMarker,
			root: forLoop.info.id
		});
	}


	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: body.exitPoints.length > 0 ? [forLoop.info.id + '-exit'] : [], entryPoints: [forLoop.info.id] };
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, params: ControlFlowInformation[], body: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph();
	const children: NodeId[] = [fn.info.id + '-params', fn.info.id + '-exit'];
	graph.addVertex({ id: fn.info.id + '-params', name: 'function-parameters', type: CfgVertexType.MidMarker, root: fn.info.id }, false);
	graph.addVertex({ id: fn.info.id + '-exit', name: 'function-exit', type: CfgVertexType.EndMarker, root: fn.info.id }, false);
	graph.addVertex({ id: fn.info.id, name: fn.type, children, type: identifyMayStatementType(fn) });

	graph.merge(body.graph, true);
	children.push(...body.graph.rootVertexIds());

	for(const param of params) {
		graph.merge(param.graph, true);
		children.push(...param.graph.rootVertexIds());
		for(const entry of param.entryPoints) {
			graph.addEdge(entry, fn.info.id, { label: 'FD' });
		}
		for(const exit of param.exitPoints) {
			graph.addEdge(fn.info.id + '-params', exit, { label: 'FD' });
		}
	}
	if(params.length === 0) {
		graph.addEdge(fn.info.id + '-params', fn.info.id, { label: 'FD' });
	}

	for(const entry of body.entryPoints) {
		graph.addEdge(entry, fn.info.id + '-params',  { label: 'FD' });
	}

	// breaks and nexts should be illegal but safe is safe i guess
	for(const next of [...body.returns,...body.breaks,...body.nexts, ...body.exitPoints]) {
		graph.addEdge(fn.info.id + '-exit', next, { label: 'FD' });
	}

	return { graph: graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [fn.info.id], entryPoints: [fn.info.id] };
}

function cfgFunctionCall(call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation {
	const graph = name.graph;
	const info = { graph, breaks: [...name.breaks], nexts: [...name.nexts], returns: [...name.returns], exitPoints: [call.info.id + '-exit'], entryPoints: [call.info.id] };

	graph.addVertex({ id: call.info.id, name: call.type, type: identifyMayStatementType(call) });

	for(const entryPoint of name.entryPoints) {
		graph.addEdge(entryPoint, call.info.id, { label: 'FD' });
	}

	graph.addVertex({ id: call.info.id + '-name', name: 'call-name', type: CfgVertexType.MidMarker, root: call.info.id });
	for(const exitPoint of name.exitPoints) {
		graph.addEdge(call.info.id + '-name', exitPoint, { label: 'FD' });
	}


	graph.addVertex({ id: call.info.id + '-exit', name: 'call-exit', type: CfgVertexType.EndMarker, root: call.info.id });

	let lastArgExits: NodeId[] = [call.info.id + '-name'];

	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		graph.merge(arg.graph);
		info.breaks.push(...arg.breaks);
		info.nexts.push(...arg.nexts);
		info.returns.push(...arg.returns);
		for(const entry of arg.entryPoints) {
			for(const exit of lastArgExits) {
				graph.addEdge(entry, exit, { label: 'FD' });
			}
		}

		lastArgExits = arg.exitPoints;
	}

	for(const exit of lastArgExits) {
		graph.addEdge(call.info.id + '-exit', exit, { label: 'FD' });
	}

	// should not contain any breaks, nexts, or returns, (except for the body if something like 'break()')
	return info;
}

function cfgFunctionCallWithDataflow(graph: DataflowGraph): typeof cfgFunctionCall {
	return (call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation => {
		const baseCFG = cfgFunctionCall(call, name, args);

		/* try to resolve the call and link the target definitions */
		const targets = getAllFunctionCallTargets(call.info.id, graph);


		const exits: NodeId[] = [];
		for(const target of targets) {
			// we have to filter out non func-call targets as the call targets contains names and call ids
			if(isFunctionDefinitionVertex(graph.getVertex(target))) {
				baseCFG.graph.addEdge(call.info.id, target, { label: 'FD' });
				exits.push(target + '-exit');
			}
		}

		if(exits.length > 0) {
			baseCFG.graph.addVertex({
				id:   call.info.id + '-resolved-call-exit',
				name: 'resolved-call-exit',
				type: CfgVertexType.EndMarker,
				root: call.info.id
			});

			for(const exit of [...baseCFG.exitPoints, ...exits]) {
				baseCFG.graph.addEdge(call.info.id + '-resolved-call-exit', exit, { label: 'FD' });
			}

			return {
				...baseCFG,
				exitPoints: [call.info.id + '-resolved-call-exit']
			};
		} else {
			return baseCFG;
		}
	};
}

function cfgArgumentOrParameter(node: RNodeWithParent, name: ControlFlowInformation | undefined, value: ControlFlowInformation | undefined): ControlFlowInformation {
	const graph = new ControlFlowGraph();
	const info: ControlFlowInformation = { graph, breaks: [], nexts: [], returns: [], exitPoints: [node.info.id + '-exit'], entryPoints: [node.info.id] };

	graph.addVertex({ id: node.info.id, name: node.type, type: CfgVertexType.Expression });

	let currentExitPoint = [node.info.id];

	if(name) {
		graph.merge(name.graph);
		info.breaks.push(...name.breaks);
		info.nexts.push(...name.nexts);
		info.returns.push(...name.returns);
		for(const entry of name.entryPoints) {
			graph.addEdge(entry, node.info.id, { label: 'FD' });
		}
		currentExitPoint = name.exitPoints;
	}

	graph.addVertex({ id: node.info.id + '-before-value', name: 'before-value', type: CfgVertexType.MidMarker, root: node.info.id });
	for(const exitPoints of currentExitPoint) {
		graph.addEdge(node.info.id + '-before-value', exitPoints, { label: 'FD' });
	}
	currentExitPoint = [node.info.id + '-before-value'];

	if(value) {
		graph.merge(value.graph);
		info.breaks.push(...value.breaks);
		info.nexts.push(...value.nexts);
		info.returns.push(...value.returns);
		for(const exitPoint of currentExitPoint) {
			for(const entry of value.entryPoints) {
				graph.addEdge(entry, exitPoint, { label: 'FD' });
			}
		}
		currentExitPoint = value.exitPoints;
	}

	graph.addVertex({ id: node.info.id + '-exit', name: 'exit', type: CfgVertexType.EndMarker, root: node.info.id });
	for(const exit of currentExitPoint) {
		graph.addEdge(node.info.id + '-exit', exit, { label: 'FD' });
	}

	return info;

}


function cfgBinaryOp(binOp: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: ControlFlowInformation, rhs: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph().merge(lhs.graph).merge(rhs.graph);
	const result: ControlFlowInformation = { graph, breaks: [...lhs.breaks, ...rhs.breaks], nexts: [...lhs.nexts, ...rhs.nexts], returns: [...lhs.returns, ...rhs.returns], entryPoints: [binOp.info.id], exitPoints: [binOp.info.id + '-exit'] };

	graph.addVertex({ id: binOp.info.id, name: binOp.type, type: binOp.flavor === 'assignment' ? CfgVertexType.Statement : CfgVertexType.Expression });
	graph.addVertex({ id: binOp.info.id + '-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker, root: binOp.info.id });

	for(const exitPoint of lhs.exitPoints) {
		for(const entryPoint of rhs.entryPoints) {
			result.graph.addEdge(entryPoint, exitPoint, { label: 'FD' });
		}
	}
	for(const entryPoint of lhs.entryPoints) {
		graph.addEdge(entryPoint, binOp.info.id, { label: 'FD' });
	}
	for(const exitPoint of rhs.exitPoints) {
		graph.addEdge(binOp.info.id + '-exit', exitPoint, { label: 'FD' });
	}

	return result;
}

function cfgAccess(access: RAccess<ParentInformation>, name: ControlFlowInformation, accessors: readonly (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation {
	const result = { ...name };
	const graph = result.graph;
	graph.addVertex({ id: access.info.id, name: access.type, type: CfgVertexType.Expression });
	result.entryPoints = [access.info.id];

	for(const entry of name.entryPoints) {
		graph.addEdge(entry, access.info.id, { label: 'FD' });
	}
	for(const exit of name.exitPoints) {
		graph.addEdge(access.info.id + '-after-name', exit, { label: 'FD' });
	}
	graph.addVertex({ id: access.info.id + '-after-name', name: access.type, type: CfgVertexType.MidMarker, root: access.info.id });

	result.exitPoints = [access.info.id + '-after-name'];

	for(const accessor of accessors) {
		if(accessor === EmptyArgument) {
			continue;
		}
		graph.merge(accessor.graph);
		for(const exitPoint of result.exitPoints) {
			for(const entry of accessor.entryPoints) {
				graph.addEdge(entry, exitPoint, { label: 'FD' });
			}
		}
		result.exitPoints = accessor.exitPoints;
		result.breaks.push(...accessor.breaks);
		result.nexts.push(...accessor.nexts);
		result.returns.push(...accessor.returns);
	}
	for(const exitPoint of result.exitPoints) {
		graph.addEdge(access.info.id + '-exit', exitPoint, { label: 'FD' });
	}
	graph.addVertex({ id: access.info.id + '-exit', name: 'access-exit', type: CfgVertexType.EndMarker, root: access.info.id });
	result.exitPoints = [access.info.id + '-exit'];
	return result;
}

function cfgUnaryOp(unary: RNodeWithParent, operand: ControlFlowInformation): ControlFlowInformation {
	const graph = operand.graph;
	graph.addVertex({ id: unary.info.id, name: unary.type, type: CfgVertexType.EndMarker, root: unary.info.id });
	for(const entry of operand.exitPoints) {
		graph.addEdge(unary.info.id, entry, { label: 'FD' });
	}

	return { ...operand, graph, exitPoints: [unary.info.id] };
}


function cfgExprList(node: RExpressionList<ParentInformation>, _grouping: unknown, expressions: ControlFlowInformation[]): ControlFlowInformation {
	const result: ControlFlowInformation = {
		graph:       new ControlFlowGraph(),
		breaks:      [],
		nexts:       [],
		returns:     [],
		exitPoints:  [node.info.id],
		entryPoints: [node.info.id]
	};
	result.graph.addVertex({ id: node.info.id, name: RType.ExpressionList, type: CfgVertexType.Expression });

	for(const expression of expressions) {
		for(const previousExitPoint of result.exitPoints) {
			for(const entryPoint of expression.entryPoints) {
				result.graph.addEdge(entryPoint, previousExitPoint, { label: 'FD' });
			}
		}
		result.graph.merge(expression.graph);
		result.breaks.push(...expression.breaks);
		result.nexts.push(...expression.nexts);
		result.returns.push(...expression.returns);
		result.exitPoints = expression.exitPoints;
	}

	if(result.exitPoints.length > 0) {
		result.graph.addVertex({
			id:   node.info.id + '-exit',
			name: RType.ExpressionList,
			type: CfgVertexType.EndMarker,
			root: node.info.id
		});
	}

	for(const exit of result.exitPoints) {
		result.graph.addEdge(node.info.id + '-exit', exit, { label: 'FD' });
	}
	result.exitPoints = result.exitPoints.length > 0 ? [node.info.id + '-exit'] : [];
	return result;
}


/**
 * Convert a cfg to RDF quads.
 *
 * @see {@link df2quads}
 * @see {@link serialize2quads}
 * @see {@link graph2quads}
 */
export function cfg2quads(cfg: ControlFlowInformation, config: QuadSerializationConfiguration): string {
	return graph2quads({
		rootIds:  [...cfg.graph.rootVertexIds()],
		vertices: [...cfg.graph.vertices().entries()]
			.map(([id, v]) => ({
				id,
				name:     v.name,
				children: v.children
			})),
		edges: [...cfg.graph.edges()].flatMap(([fromId, targets]) =>
			[...targets].map(([toId, info]) => ({
				from: fromId,
				to:   toId,
				type: info.label,
				when: info.when
			}))
		),
		entryPoints: cfg.entryPoints,
		exitPoints:  cfg.exitPoints,
		breaks:      cfg.breaks,
		nexts:       cfg.nexts,
		returns:     cfg.returns
	},
	config
	);
}
