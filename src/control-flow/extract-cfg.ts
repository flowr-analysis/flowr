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
import type { ControlFlowInformation } from './control-flow-graph';
import { CfgEdgeType, CfgVertexType, ControlFlowGraph } from './control-flow-graph';
import type { CfgSimplificationPassName } from './cfg-simplification';
import { simplifyControlFlowInformation } from './cfg-simplification';
import { guard } from '../util/assert';
import type { FlowrConfigOptions } from '../config';


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
 * This view is different from the computation of the dataflow graph and may differ,
 * especially because it focuses on intra-procedural analysis.
 *
 * @param ast             - the normalized AST
 * @param config          - the Flowr config
 * @param graph           - additional dataflow facts to consider by the control flow extraction
 * @param simplifications - a list of simplification passes to apply to the control flow graph
 *
 * @see {@link extractSimpleCfg} - for a simplified version of this function
 */
export function extractCfg<Info = ParentInformation>(
	ast:    NormalizedAst<Info & ParentInformation>,
	config: FlowrConfigOptions,
	graph?: DataflowGraph,
	simplifications?: readonly CfgSimplificationPassName[]
): ControlFlowInformation {
	return simplifyControlFlowInformation(foldAst(ast.ast, graph ? dataflowCfgFolds(graph) : cfgFolds), { ast, dfg: graph, config }, simplifications);
}

/**
 * Simplified version of {@link extractCfg} that is much quicker, but much simpler!
 */
export function extractSimpleCfg<Info = ParentInformation>(ast: NormalizedAst<Info>) {
	return foldAst(ast.ast, cfgFolds);
}

function cfgLeaf(type: CfgVertexType.Expression | CfgVertexType.Statement): (leaf: RNodeWithParent) => ControlFlowInformation {
	return ({ info: { id } }: RNodeWithParent) => {
		return { graph: new ControlFlowGraph().addVertex({ id, type }), breaks: [], nexts: [], returns: [], exitPoints: [id], entryPoints: [id] };
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
	const ifId = ifNode.info.id;
	const graph = new ControlFlowGraph();
	graph.addVertex({ id: ifId, type: identifyMayStatementType(ifNode), mid: [ifId + '-condition'], end: [ifId + '-exit'] });
	graph.addVertex({ id: ifId + '-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: ifId });
	graph.addVertex({ id: ifId + '-exit', type: CfgVertexType.EndMarker, root: ifId });
	graph.mergeWith(condition.graph);
	graph.mergeWith(then.graph);
	if(otherwise) {
		graph.mergeWith(otherwise.graph);
	}

	for(const exitPoint of condition.exitPoints) {
		graph.addEdge(ifId + '-condition', exitPoint, { label: CfgEdgeType.Fd });
	}

	for(const entryPoint of then.entryPoints) {
		graph.addEdge(entryPoint, ifId + '-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: ifId });
	}
	for(const entryPoint of otherwise?.entryPoints ?? []) {
		graph.addEdge(entryPoint, ifId + '-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: ifId });
	}

	for(const entryPoint of condition.entryPoints) {
		graph.addEdge(entryPoint, ifId, { label: CfgEdgeType.Fd });
	}

	for(const exit of [...then.exitPoints, ...otherwise?.exitPoints ?? []]) {
		graph.addEdge(ifId + '-exit', exit, { label: CfgEdgeType.Fd });
	}
	if(!otherwise) {
		graph.addEdge(ifId + '-exit', ifId + '-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: ifId });
	}

	return {
		graph,
		breaks:      [...then.breaks, ...otherwise?.breaks ?? []],
		nexts:       [...then.nexts, ...otherwise?.nexts ?? []],
		returns:     [...then.returns, ...otherwise?.returns ?? []],
		exitPoints:  [ifId + '-exit'],
		entryPoints: [ifId]
	};
}

function cfgRepeat(repeat: RRepeatLoop<ParentInformation>, body: ControlFlowInformation): ControlFlowInformation {
	const graph = body.graph;
	graph.addVertex({ id: repeat.info.id, type: identifyMayStatementType(repeat), end: [repeat.info.id + '-exit'] });
	graph.addVertex({ id: repeat.info.id + '-exit', type: CfgVertexType.EndMarker, root: repeat.info.id });

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(entryPoint, repeat.info.id, { label: CfgEdgeType.Fd });
	}

	// loops automatically
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(repeat.info.id, next, { label: CfgEdgeType.Fd });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(repeat.info.id + '-exit', breakPoint, { label: CfgEdgeType.Fd });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [repeat.info.id + '-exit'], entryPoints: [repeat.info.id] };
}

function cfgWhile(whileLoop: RWhileLoop<ParentInformation>, condition: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const whileId = whileLoop.info.id;
	const graph = condition.graph;
	graph.addVertex({ id: whileId, type: identifyMayStatementType(whileLoop), mid: [whileId + '-condition'], end: [whileId + '-exit'] });
	graph.addVertex({ id: whileId + '-condition', kind: 'condition', type: CfgVertexType.MidMarker, root: whileId });
	graph.addVertex({ id: whileId + '-exit', type: CfgVertexType.EndMarker, root: whileId });

	graph.mergeWith(body.graph);

	for(const entry of condition.entryPoints) {
		graph.addEdge(entry, whileId, { label: CfgEdgeType.Fd });
	}

	for(const exit of condition.exitPoints) {
		graph.addEdge(whileId + '-condition', exit, { label: CfgEdgeType.Fd });
	}

	for(const entry of body.entryPoints) {
		graph.addEdge(entry, whileId + '-condition', { label: CfgEdgeType.Cd, when: RTrue, caused: whileId });
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(whileId, next, { label: CfgEdgeType.Fd });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(whileId + '-exit', breakPoint, { label: CfgEdgeType.Fd });
	}
	// while can break on the condition as well
	graph.addEdge(whileId + '-exit', whileId + '-condition', { label: CfgEdgeType.Cd, when: RFalse, caused: whileId  });

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [whileId + '-exit'], entryPoints: [whileId] };
}


function cfgFor(forLoop: RForLoop<ParentInformation>, variable: ControlFlowInformation, vector: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const forLoopId = forLoop.info.id;
	const graph = variable.graph;
	graph.addVertex({ id: forLoopId, type: identifyMayStatementType(forLoop), end: [forLoopId + '-exit'], mid: [forLoopId + '-head'] });

	graph.mergeWith(vector.graph);
	graph.mergeWith(body.graph);

	for(const entry of vector.entryPoints) {
		graph.addEdge(entry, forLoopId, { label: CfgEdgeType.Fd });
	}

	for(const exit of vector.exitPoints) {
		for(const entry of variable.entryPoints) {
			graph.addEdge(entry, exit, { label: CfgEdgeType.Fd });
		}
	}

	graph.addVertex({ id: forLoopId + '-head', type: CfgVertexType.MidMarker, root: forLoopId, kind: 'head' });

	for(const exit of variable.exitPoints) {
		graph.addEdge(forLoopId + '-head', exit, { label: CfgEdgeType.Fd });
	}
	for(const entry of body.entryPoints) {
		graph.addEdge(entry, forLoopId + '-head', { label: CfgEdgeType.Cd, when: RTrue, caused: forLoopId });
	}

	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(forLoopId, next, { label: CfgEdgeType.Fd });
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(forLoopId + '-exit', breakPoint, { label: CfgEdgeType.Fd });
	}

	const isNotEndless = body.exitPoints.length > 0 || body.breaks.length > 0;
	if(isNotEndless) {
		graph.addVertex({
			id:   forLoopId + '-exit',
			type: CfgVertexType.EndMarker,
			root: forLoopId
		});
		graph.addEdge(forLoopId + '-exit', forLoopId + '-head', { label: CfgEdgeType.Cd, when: RFalse, caused: forLoopId });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: isNotEndless ? [forLoopId + '-exit'] : [], entryPoints: [forLoopId] };
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, params: ControlFlowInformation[], body: ControlFlowInformation): ControlFlowInformation {
	const fnId = fn.info.id;
	const graph = new ControlFlowGraph();
	const children: NodeId[] = [fnId + '-params', fnId + '-exit'];
	graph.addVertex({ id: fnId + '-params', kind: 'parameters', type: CfgVertexType.MidMarker, root: fnId }, false);
	graph.addVertex({ id: fnId + '-exit', type: CfgVertexType.EndMarker, root: fnId }, false);
	graph.addVertex({ id: fnId, children, type: identifyMayStatementType(fn), mid: [fnId + '-params'], end: [fnId + '-exit'] });

	graph.mergeWith(body.graph, true);
	children.push(...body.graph.rootIds());

	for(const param of params) {
		graph.mergeWith(param.graph, true);
		children.push(...param.graph.rootIds());
		for(const entry of param.entryPoints) {
			graph.addEdge(entry, fnId, { label: CfgEdgeType.Fd });
		}
		for(const exit of param.exitPoints) {
			graph.addEdge(fnId + '-params', exit, { label: CfgEdgeType.Fd });
		}
	}
	if(params.length === 0) {
		graph.addEdge(fnId + '-params', fnId, { label: CfgEdgeType.Fd });
	}

	for(const entry of body.entryPoints) {
		graph.addEdge(entry, fnId + '-params',  { label: CfgEdgeType.Fd });
	}

	// breaks and nexts should be illegal but safe is safe, I guess
	for(const next of body.returns.concat(body.breaks, body.nexts, body.exitPoints)) {
		graph.addEdge(fnId + '-exit', next, { label: CfgEdgeType.Fd });
	}

	return { graph: graph, breaks: [], nexts: [], returns: [], exitPoints: [fnId], entryPoints: [fnId] };
}

function cfgFunctionCall(call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[], exit = 'exit'): ControlFlowInformation {
	const callId = call.info.id;
	const graph = name.graph;
	const info = { graph, breaks: [...name.breaks], nexts: [...name.nexts], returns: [...name.returns], exitPoints: [callId + '-' + exit], entryPoints: [callId] };

	graph.addVertex({ id: callId, type: identifyMayStatementType(call), mid: [callId + '-name'], end: [callId + '-' + exit] });

	for(const entryPoint of name.entryPoints) {
		graph.addEdge(entryPoint, callId, { label: CfgEdgeType.Fd });
	}

	graph.addVertex({ id: callId + '-name', kind: 'name', type: CfgVertexType.MidMarker, root: callId });
	for(const exitPoint of name.exitPoints) {
		graph.addEdge(callId + '-name', exitPoint, { label: CfgEdgeType.Fd });
	}


	graph.addVertex({ id: callId + '-' + exit, type: CfgVertexType.EndMarker, root: callId });

	let lastArgExits: NodeId[] = [callId + '-name'];

	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		graph.mergeWith(arg.graph);
		info.breaks = info.breaks.concat(arg.breaks);
		info.nexts = info.nexts.concat(arg.nexts);
		info.returns = info.returns.concat(arg.returns);

		for(const entry of arg.entryPoints) {
			for(const exit of lastArgExits) {
				graph.addEdge(entry, exit, { label: CfgEdgeType.Fd });
			}
		}

		lastArgExits = arg.exitPoints;
	}

	for(const exit of lastArgExits) {
		graph.addEdge(callId + '-exit', exit, { label: CfgEdgeType.Fd });
	}

	// should not contain any breaks, nexts, or returns, (except for the body if something like 'break()')
	return info;
}

export const ResolvedCallSuffix = '-resolved-call-exit';

function cfgFunctionCallWithDataflow(graph: DataflowGraph): typeof cfgFunctionCall {
	return (call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation => {
		const baseCfg = cfgFunctionCall(call, name, args);

		/* try to resolve the call and link the target definitions */
		const targets = getAllFunctionCallTargets(call.info.id, graph);

		const exits: NodeId[] = [];
		const callVertex = baseCfg.graph.getVertex(call.info.id);
		guard(callVertex !== undefined, 'cfgFunctionCallWithDataflow: call vertex not found');
		for(const target of targets) {
			// we have to filter out non func-call targets as the call targets contains names and call ids
			if(isFunctionDefinitionVertex(graph.getVertex(target))) {
				callVertex.callTargets ??= new Set();
				callVertex.callTargets.add(target);
				exits.push(target + '-exit');
			}
		}

		if(exits.length > 0) {
			baseCfg.graph.addVertex({
				id:   call.info.id + ResolvedCallSuffix,
				type: CfgVertexType.EndMarker,
				root: call.info.id
			});

			for(const exit of [...baseCfg.exitPoints, ...exits]) {
				baseCfg.graph.addEdge(call.info.id + ResolvedCallSuffix, exit, { label: CfgEdgeType.Fd });
			}

			return {
				...baseCfg,
				exitPoints: [call.info.id + ResolvedCallSuffix]
			};
		} else {
			return baseCfg;
		}
	};
}

function cfgArgumentOrParameter(node: RNodeWithParent, name: ControlFlowInformation | undefined, value: ControlFlowInformation | undefined): ControlFlowInformation {
	const graph = new ControlFlowGraph();
	const info: ControlFlowInformation = { graph, breaks: [], nexts: [], returns: [], exitPoints: [node.info.id + '-exit'], entryPoints: [node.info.id] };

	graph.addVertex({ id: node.info.id, type: CfgVertexType.Expression, mid: [node.info.id + '-before-value'], end: [node.info.id + '-exit'] });

	let currentExitPoint = [node.info.id];

	if(name) {
		graph.mergeWith(name.graph);
		info.breaks = info.breaks.concat(name.breaks);
		info.nexts = info.nexts.concat(name.nexts);
		info.returns = info.returns.concat(name.returns);

		for(const entry of name.entryPoints) {
			graph.addEdge(entry, node.info.id, { label: CfgEdgeType.Fd });
		}
		currentExitPoint = name.exitPoints;
	}

	graph.addVertex({ id: node.info.id + '-before-value', kind: 'before-value', type: CfgVertexType.MidMarker, root: node.info.id });
	for(const exitPoints of currentExitPoint) {
		graph.addEdge(node.info.id + '-before-value', exitPoints, { label: CfgEdgeType.Fd });
	}
	currentExitPoint = [node.info.id + '-before-value'];

	if(value) {
		graph.mergeWith(value.graph);
		info.breaks = info.breaks.concat(value.breaks);
		info.nexts = info.nexts.concat(value.nexts);
		info.returns = info.returns.concat(value.returns);

		for(const exitPoint of currentExitPoint) {
			for(const entry of value.entryPoints) {
				graph.addEdge(entry, exitPoint, { label: CfgEdgeType.Fd });
			}
		}
		currentExitPoint = value.exitPoints;
	}

	graph.addVertex({ id: node.info.id + '-exit', type: CfgVertexType.EndMarker, root: node.info.id });
	for(const exit of currentExitPoint) {
		graph.addEdge(node.info.id + '-exit', exit, { label: CfgEdgeType.Fd });
	}

	return info;

}

function cfgBinaryOp(binOp: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: ControlFlowInformation, rhs: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph().mergeWith(lhs.graph).mergeWith(rhs.graph);
	const result: ControlFlowInformation = { graph, breaks: [...lhs.breaks, ...rhs.breaks], nexts: [...lhs.nexts, ...rhs.nexts], returns: [...lhs.returns, ...rhs.returns], entryPoints: [binOp.info.id], exitPoints: [binOp.info.id + '-exit'] };

	graph.addVertex({ id: binOp.info.id, type: binOp.flavor === 'assignment' ? CfgVertexType.Statement : CfgVertexType.Expression, end: [binOp.info.id + '-exit'] });
	graph.addVertex({ id: binOp.info.id + '-exit', type: CfgVertexType.EndMarker, root: binOp.info.id });

	for(const exitPoint of lhs.exitPoints) {
		for(const entryPoint of rhs.entryPoints) {
			result.graph.addEdge(entryPoint, exitPoint, { label: CfgEdgeType.Fd });
		}
	}
	for(const entryPoint of lhs.entryPoints) {
		graph.addEdge(entryPoint, binOp.info.id, { label: CfgEdgeType.Fd });
	}
	for(const exitPoint of rhs.exitPoints) {
		graph.addEdge(binOp.info.id + '-exit', exitPoint, { label: CfgEdgeType.Fd });
	}

	return result;
}

function cfgAccess(access: RAccess<ParentInformation>, name: ControlFlowInformation, accessors: readonly (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation {
	const result = { ...name };
	const graph = result.graph;
	graph.addVertex({ id: access.info.id, type: CfgVertexType.Expression, mid: [access.info.id + '-after-name'], end: [access.info.id + '-exit'] });
	result.entryPoints = [access.info.id];

	for(const entry of name.entryPoints) {
		graph.addEdge(entry, access.info.id, { label: CfgEdgeType.Fd });
	}
	for(const exit of name.exitPoints) {
		graph.addEdge(access.info.id + '-after-name', exit, { label: CfgEdgeType.Fd });
	}
	graph.addVertex({ id: access.info.id + '-after-name', kind: 'after-name', type: CfgVertexType.MidMarker, root: access.info.id });

	result.exitPoints = [access.info.id + '-after-name'];

	for(const accessor of accessors) {
		if(accessor === EmptyArgument) {
			continue;
		}
		graph.mergeWith(accessor.graph);
		for(const exitPoint of result.exitPoints) {
			for(const entry of accessor.entryPoints) {
				graph.addEdge(entry, exitPoint, { label: CfgEdgeType.Fd });
			}
		}
		result.exitPoints = accessor.exitPoints;
		result.breaks = result.breaks.concat(accessor.breaks);
		result.nexts = result.nexts.concat(accessor.nexts);
		result.returns = result.returns.concat(accessor.returns);
	}
	for(const exitPoint of result.exitPoints) {
		graph.addEdge(access.info.id + '-exit', exitPoint, { label: CfgEdgeType.Fd });
	}
	graph.addVertex({ id: access.info.id + '-exit', type: CfgVertexType.EndMarker, root: access.info.id });
	result.exitPoints = [access.info.id + '-exit'];
	return result;
}

function cfgUnaryOp(unary: RNodeWithParent, operand: ControlFlowInformation): ControlFlowInformation {
	const graph = operand.graph;
	graph.addVertex({ id: unary.info.id, type: CfgVertexType.EndMarker, root: unary.info.id });
	for(const entry of operand.exitPoints) {
		graph.addEdge(unary.info.id, entry, { label: CfgEdgeType.Fd });
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
	const vtx = { id: node.info.id, type: CfgVertexType.Expression as const, end: [] as NodeId[] | undefined };
	result.graph.addVertex(vtx);

	for(const expression of expressions) {
		for(const previousExitPoint of result.exitPoints) {
			for(const entryPoint of expression.entryPoints) {
				result.graph.addEdge(entryPoint, previousExitPoint, { label: CfgEdgeType.Fd });
			}
		}
		result.graph.mergeWith(expression.graph);
		result.breaks = result.breaks.concat(expression.breaks);
		result.nexts = result.nexts.concat(expression.nexts);
		result.returns = result.returns.concat(expression.returns);
		result.exitPoints = expression.exitPoints;
	}

	if(result.exitPoints.length > 0) {
		result.graph.addVertex({
			id:   node.info.id + '-exit',
			type: CfgVertexType.EndMarker,
			root: node.info.id
		});
		vtx.end = [node.info.id + '-exit'];
	} else {
		vtx.end = undefined;
	}

	for(const exit of result.exitPoints) {
		result.graph.addEdge(node.info.id + '-exit', exit, { label: CfgEdgeType.Fd });
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
		rootIds:  [...cfg.graph.rootIds()],
		vertices: [...cfg.graph.vertices().entries()]
			.map(([id, v]) => ({
				id,
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
