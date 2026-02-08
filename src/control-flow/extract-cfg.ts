import { graph2quads, type QuadSerializationConfiguration } from '../util/quads';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { foldAst, type FoldFunctions } from '../r-bridge/lang-4.x/ast/model/processing/fold';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument, type RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { getAllFunctionCallTargets } from '../dataflow/internal/linker';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { isFunctionCallVertex, isFunctionDefinitionVertex, VertexType } from '../dataflow/graph/vertex';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { type CfgExpressionVertex,
	CfgEdge, CfgVertex,
	CfgVertexType,
	ControlFlowGraph,
	type ControlFlowInformation,
	emptyControlFlowInformation
} from './control-flow-graph';
import { type CfgSimplificationPassName, simplifyControlFlowInformation } from './cfg-simplification';
import { guard } from '../util/assert';
import type { RProject } from '../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { BuiltInProcName } from '../dataflow/environments/built-in';
import type { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';


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

const ignoreFunctDefCfgFolds: FoldFunctions<ParentInformation, ControlFlowInformation> = {
	...cfgFolds,
	functions: {
		...cfgFolds.functions,
		foldFunctionDefinition: cfgLeaf(CfgVertexType.Expression)
	}
};

function dataflowCfgFolds(dataflowGraph: DataflowGraph): FoldFunctions<ParentInformation, ControlFlowInformation> {
	const newFolds = {
		...cfgFolds,
	};
	newFolds.functions = {
		...cfgFolds.functions,
		foldFunctionCall: cfgFunctionCallWithDataflow(dataflowGraph, newFolds)
	};
	return newFolds;
}

/**
 * Given a normalized AST, this approximates the control flow graph of the program.
 * This view is different from the computation of the dataflow graph and may differ,
 * especially because it focuses on intra-procedural analysis.
 * @param ast             - the normalized AST
 * @param ctx             - the flowR context
 * @param graph           - additional dataflow facts to consider by the control flow extraction
 * @param simplifications - a list of simplification passes to apply to the control flow graph
 * @param ignoreFunctDefs - whether function definition vertices should be ignored
 * @see {@link extractCfgQuick} - for a simplified version of this function
 */
export function extractCfg<Info = ParentInformation>(
	ast:    NormalizedAst<Info & ParentInformation>,
	ctx:    ReadOnlyFlowrAnalyzerContext,
	graph?: DataflowGraph,
	simplifications?: readonly CfgSimplificationPassName[],
	ignoreFunctDefs?: boolean
): ControlFlowInformation {
	const folds = ignoreFunctDefs ? ignoreFunctDefCfgFolds : (graph ? dataflowCfgFolds(graph) : cfgFolds);
	return simplifyControlFlowInformation(cfgFoldProject(ast.ast, folds), { ast, dfg: graph, ctx }, simplifications);
}

/**
 * A version of {@link extractCfg} that is much quicker and does not apply any simplifications or dataflow information.
 */
export function extractCfgQuick<Info = ParentInformation>(ast: NormalizedAst<Info>) {
	return cfgFoldProject(ast.ast, cfgFolds);
}

/**
 * Extracts all function call vertices from the given control flow information and dataflow graph.
 */
export function getCallsInCfg(cfg: ControlFlowInformation, graph: DataflowGraph): Map<NodeId, Required<DataflowGraphVertexFunctionCall>> {
	const calls = new Map<NodeId, Required<DataflowGraphVertexFunctionCall>>();
	for(const vertexId of cfg.graph.vertices().keys()) {
		const vertex = graph.getVertex(vertexId);
		if(isFunctionCallVertex(vertex)) {
			calls.set(vertexId, vertex);
		}
	}
	return calls;
}

function cfgFoldProject(proj: RProject<ParentInformation>, folds: FoldFunctions<ParentInformation, ControlFlowInformation>): ControlFlowInformation {
	if(proj.files.length === 0) {
		return emptyControlFlowInformation();
	} else if(proj.files.length === 1) {
		return foldAst(proj.files[0].root, folds);
	}
	const perProject = proj.files.map(file => foldAst(file.root, folds));
	const finalGraph = perProject[0].graph;
	for(let i = 1; i < perProject.length; i++) {
		finalGraph.mergeWith(perProject[i].graph);
		for(const exitPoint of perProject[i - 1].exitPoints) {
			for(const entryPoint of perProject[i].entryPoints) {
				finalGraph.addEdge(entryPoint, exitPoint, CfgEdge.makeFd());
			}
		}
	}
	return {
		breaks:      perProject.flatMap(e => e.breaks),
		nexts:       perProject.flatMap(e => e.nexts),
		returns:     perProject.flatMap(e => e.returns),
		exitPoints:  (perProject.at(-1) as ControlFlowInformation).exitPoints,
		entryPoints: perProject[0].entryPoints,
		graph:       finalGraph
	};
}

function cfgLeaf(type: CfgVertexType.Expression | CfgVertexType.Statement): (leaf: RNodeWithParent) => ControlFlowInformation {
	return type === CfgVertexType.Expression ? ({ info: { id } }: { info: { id: NodeId } }) => {
		return { graph: new ControlFlowGraph().addVertex(CfgVertex.makeExpression(id)), breaks: [], nexts: [], returns: [], exitPoints: [id], entryPoints: [id] };
	} : ({ info: { id } }: { info: { id: NodeId } }) => {
		return { graph: new ControlFlowGraph().addVertex(CfgVertex.makeStatement(id)), breaks: [], nexts: [], returns: [], exitPoints: [id], entryPoints: [id] };
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
	graph.addVertex(CfgVertex.makeExprOrStm(ifId, identifyMayStatementType(ifNode), { mid: condition.exitPoints, end: [CfgVertex.toExitId(ifId)] }));
	graph.addVertex(CfgVertex.makeExitMarker(ifId));
	graph.mergeWith(condition.graph);
	graph.mergeWith(then.graph);
	if(otherwise) {
		graph.mergeWith(otherwise.graph);
	}

	for(const e of condition.exitPoints) {
		for(const entryPoint of then.entryPoints) {
			graph.addEdge(entryPoint, e, CfgEdge.makeCdTrue(ifId));
		}
		for(const entryPoint of otherwise?.entryPoints ?? []) {
			graph.addEdge(entryPoint, e, CfgEdge.makeCdFalse(ifId));
		}
	}

	for(const entryPoint of condition.entryPoints) {
		graph.addEdge(entryPoint, ifId, CfgEdge.makeFd());
	}

	for(const exits of [then.exitPoints, otherwise?.exitPoints ?? []]) {
		for(const exit of exits) {
			graph.addEdge(CfgVertex.toExitId(ifId), exit, CfgEdge.makeFd());
		}
	}
	if(!otherwise) {
		for(const e of condition.exitPoints) {
			graph.addEdge(CfgVertex.toExitId(ifId), e, CfgEdge.makeCdFalse(ifId));
		}
	}

	return {
		graph,
		breaks:      then.breaks.concat(otherwise?.breaks ?? []),
		nexts:       then.nexts.concat(otherwise?.nexts ?? []),
		returns:     then.returns.concat(otherwise?.returns ?? []),
		exitPoints:  [CfgVertex.toExitId(ifId)],
		entryPoints: [ifId]
	};
}

function cfgRepeat(repeat: RRepeatLoop<ParentInformation>, body: ControlFlowInformation): ControlFlowInformation {
	const graph = body.graph;
	const rid = repeat.info.id;
	graph.addVertex(CfgVertex.makeExprOrStm(rid, identifyMayStatementType(repeat), { end: [CfgVertex.toExitId(rid)] }));
	graph.addVertex(CfgVertex.makeExitMarker(rid));

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(entryPoint, rid, CfgEdge.makeFd());
	}

	// loops automatically
	for(const nexts of [body.nexts, body.exitPoints]) {
		for(const next of nexts) {
			graph.addEdge(rid, next, CfgEdge.makeFd());
		}
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(CfgVertex.toExitId(rid), breakPoint, CfgEdge.makeFd());
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [CfgVertex.toExitId(rid)], entryPoints: [rid] };
}

function cfgWhile(whileLoop: RWhileLoop<ParentInformation>, condition: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const whileId = whileLoop.info.id;
	const graph = condition.graph;
	graph.addVertex(CfgVertex.makeExprOrStm(whileId, identifyMayStatementType(whileLoop), { mid: condition.exitPoints, end: [CfgVertex.toExitId(whileId)] }));
	graph.addVertex(CfgVertex.makeExitMarker(whileId));

	graph.mergeWith(body.graph);

	for(const entry of condition.entryPoints) {
		graph.addEdge(entry, whileId, CfgEdge.makeFd());
	}

	for(const e of condition.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, e, CfgEdge.makeCdTrue(whileId));
		}
	}

	for(const nexts of [body.nexts, body.exitPoints]) {
		for(const next of nexts) {
			graph.addEdge(whileId, next, CfgEdge.makeFd());
		}
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(CfgVertex.toExitId(whileId), breakPoint, CfgEdge.makeFd());
	}
	// while can break on the condition as well
	for(const e of condition.exitPoints) {
		graph.addEdge(CfgVertex.toExitId(whileId), e, CfgEdge.makeCdFalse(whileId));
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [CfgVertex.toExitId(whileId)], entryPoints: [whileId] };
}


function cfgFor(forLoop: RForLoop<ParentInformation>, variable: ControlFlowInformation, vector: ControlFlowInformation, body: ControlFlowInformation): ControlFlowInformation {
	const forLoopId = forLoop.info.id;
	const graph = variable.graph;
	graph.addVertex(CfgVertex.makeExprOrStm(forLoopId, identifyMayStatementType(forLoop), { mid: variable.exitPoints, end: [CfgVertex.toExitId(forLoopId)] }));

	graph.mergeWith(vector.graph);
	graph.mergeWith(body.graph);

	for(const entry of vector.entryPoints) {
		graph.addEdge(entry, forLoopId, CfgEdge.makeFd());
	}

	for(const exit of vector.exitPoints) {
		for(const entry of variable.entryPoints) {
			graph.addEdge(entry, exit, CfgEdge.makeFd());
		}
	}

	for(const e of variable.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, e, CfgEdge.makeCdTrue(forLoopId));
		}
	}

	for(const points of [body.nexts, body.exitPoints]) {
		for(const next of points) {
			graph.addEdge(forLoopId, next, CfgEdge.makeFd());
		}
	}

	for(const breakPoint of body.breaks) {
		graph.addEdge(CfgVertex.toExitId(forLoopId), breakPoint, CfgEdge.makeFd());
	}

	const isNotEndless = body.exitPoints.length > 0 || body.breaks.length > 0;
	if(isNotEndless) {
		graph.addVertex(CfgVertex.makeExitMarker(forLoopId));
		for(const e of variable.exitPoints) {
			graph.addEdge(CfgVertex.toExitId(forLoopId), e, CfgEdge.makeCdFalse(forLoopId));
		}
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: isNotEndless ? [CfgVertex.toExitId(forLoopId)] : [], entryPoints: [forLoopId] };
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, params: ControlFlowInformation[], body: ControlFlowInformation): ControlFlowInformation {
	const fnId = fn.info.id;
	const graph = new ControlFlowGraph();
	let paramExits = params.flatMap(e => e.exitPoints);
	const children: NodeId[] = [...paramExits, CfgVertex.toExitId(fnId)];
	graph.addVertex(CfgVertex.makeExitMarker(fnId), false);
	graph.addVertex(CfgVertex.makeExprOrStm(fnId, identifyMayStatementType(fn), { children, mid: paramExits, end: [CfgVertex.toExitId(fnId)] }));

	graph.mergeWith(body.graph, true);
	for(const r of body.graph.rootIds()) {
		children.push(r);
	}

	for(const param of params) {
		graph.mergeWith(param.graph, true);
		for(const r of param.graph.rootIds()) {
			children.push(r);
		}
		for(const entry of param.entryPoints) {
			graph.addEdge(entry, fnId, CfgEdge.makeFd());
		}
	}
	if(paramExits.length === 0) {
		paramExits = [fnId];
	}

	for(const e of paramExits) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, e, CfgEdge.makeFd());
		}
	}

	// breaks and nexts should be illegal but safe is safe, I guess
	for(const next of body.returns.concat(body.breaks, body.nexts, body.exitPoints)) {
		graph.addEdge(CfgVertex.toExitId(fnId), next, CfgEdge.makeFd());
	}

	return { graph: graph, breaks: [], nexts: [], returns: [], exitPoints: [fnId], entryPoints: [fnId] };
}

function cfgFunctionCall(call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation {
	if(call.named && call.functionName.content === 'ifelse') {
		// special built-in handling for ifelse as it is an expression that does not short-circuit
		return cfgIfThenElse(
			call as RNodeWithParent,
			args[0] === EmptyArgument ? emptyControlFlowInformation() : args[0],
			args[1] === EmptyArgument ? emptyControlFlowInformation() : args[1],
			args[2] === EmptyArgument ? emptyControlFlowInformation() : args[2]
		);
	}
	const callId = call.info.id;
	const graph = name.graph;
	const info = {
		graph,
		breaks:      Array.from(name.breaks),
		nexts:       Array.from(name.nexts),
		returns:     Array.from(name.returns),
		exitPoints:  [CfgVertex.toExitId(callId)],
		entryPoints: [callId]
	};

	graph.addVertex(CfgVertex.makeExprOrStm(callId, identifyMayStatementType(call), { mid: name.exitPoints, end: [CfgVertex.toExitId(callId)] }));

	for(const entryPoint of name.entryPoints) {
		graph.addEdge(entryPoint, callId, CfgEdge.makeFd());
	}

	graph.addVertex(CfgVertex.makeExitMarker(callId));

	let lastArgExits: NodeId[] = name.exitPoints;

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
				graph.addEdge(entry, exit, CfgEdge.makeFd());
			}
		}

		lastArgExits = arg.exitPoints;
	}

	for(const exit of lastArgExits) {
		graph.addEdge(CfgVertex.toExitId(callId), exit, CfgEdge.makeFd());
	}

	if(call.named && call.functionName.content === 'return') {
		info.returns.push(CfgVertex.toExitId(callId));
		info.exitPoints.length = 0;
	}

	// should not contain any breaks, nexts, or returns, (except for the body if something like 'break()')
	return info;
}

export const ResolvedCallSuffix = CfgVertex.toExitId('-resolved-call');

const OriginToFoldTypeMap: Partial<Record<BuiltInProcName, (folds: FoldFunctions<ParentInformation, ControlFlowInformation>, call: RFunctionCall<ParentInformation>, args: (ControlFlowInformation | typeof EmptyArgument)[], callVtx: DataflowGraphVertexFunctionCall) => ControlFlowInformation>> = {
	[BuiltInProcName.IfThenElse]: (folds, call, args) => {
		// arguments are in order!
		return folds.foldIfThenElse(
			call as RNodeWithParent as RIfThenElse<ParentInformation>, // we will have to this more sophisticated if we rewrite the dfg based generation
			args[0] === EmptyArgument ? emptyControlFlowInformation() : args[0],
			args[1] === EmptyArgument ? emptyControlFlowInformation() : args[1],
			args[2] === EmptyArgument ? emptyControlFlowInformation() : args[2],
			undefined
		);
	}
};
function cfgFunctionCallWithDataflow(graph: DataflowGraph, folds: FoldFunctions<ParentInformation, ControlFlowInformation>): typeof cfgFunctionCall {
	return (call: RFunctionCall<ParentInformation>, name: ControlFlowInformation, args: (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation => {
		const vtx = graph.getVertex(call.info.id);
		if(vtx?.tag === VertexType.FunctionCall && vtx.onlyBuiltin && vtx.origin.length === 1) {
			const mayMap = OriginToFoldTypeMap[vtx.origin[0] as BuiltInProcName];
			if(mayMap) {
				return mayMap(folds, call, args, vtx);
			}
		}
		const baseCfg = cfgFunctionCall(call, name, args);

		/* try to resolve the call and link the target definitions */
		const targets = getAllFunctionCallTargets(call.info.id, graph);

		const exits: NodeId[] = [];
		const callVertex = baseCfg.graph.getVertex(call.info.id);
		guard(callVertex !== undefined, 'cfgFunctionCallWithDataflow: call vertex not found');
		for(const target of targets) {
			// we have to filter out non-func-call targets as the call targets contains names and call ids
			if(isFunctionDefinitionVertex(graph.getVertex(target))) {
				const ct = CfgVertex.getCallTargets(callVertex);
				if(!ct) {
					CfgVertex.setCallTargets(callVertex as CfgExpressionVertex, new Set([target]));
				} else {
					ct.add(target);
				}
				exits.push(CfgVertex.toExitId(target));
			}
		}

		if(exits.length > 0) {
			baseCfg.graph.addVertex(CfgVertex.makeMarker(
				call.info.id + ResolvedCallSuffix,
				call.info.id
			));

			for(const col of [baseCfg.exitPoints, exits]) {
				for(const exit of col) {
					baseCfg.graph.addEdge(call.info.id + ResolvedCallSuffix, exit, CfgEdge.makeFd());
				}
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
	const nodeId = node.info.id;
	const info: ControlFlowInformation = { graph, breaks: [], nexts: [], returns: [], exitPoints: [CfgVertex.toExitId(nodeId)], entryPoints: [nodeId] };

	let currentExitPoints = name?.exitPoints ?? [nodeId];
	graph.addVertex(CfgVertex.makeExpressionWithEnd(nodeId, { mid: currentExitPoints }));

	if(name) {
		graph.mergeWith(name.graph);
		info.breaks = info.breaks.concat(name.breaks);
		info.nexts = info.nexts.concat(name.nexts);
		info.returns = info.returns.concat(name.returns);

		for(const entry of name.entryPoints) {
			graph.addEdge(entry, nodeId, CfgEdge.makeFd());
		}
	}

	if(value) {
		graph.mergeWith(value.graph);
		info.breaks = info.breaks.concat(value.breaks);
		info.nexts = info.nexts.concat(value.nexts);
		info.returns = info.returns.concat(value.returns);

		for(const exitPoint of currentExitPoints) {
			for(const entry of value.entryPoints) {
				graph.addEdge(entry, exitPoint, CfgEdge.makeFd());
			}
		}
		currentExitPoints = value.exitPoints;
	}

	graph.addVertex(CfgVertex.makeExitMarker(nodeId));
	for(const exit of currentExitPoints) {
		graph.addEdge(CfgVertex.toExitId(nodeId), exit, CfgEdge.makeFd());
	}

	return info;
}

function cfgBinaryOp(binOp: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: ControlFlowInformation, rhs: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph().mergeWith(lhs.graph).mergeWith(rhs.graph);
	const binId = binOp.info.id;
	const result: ControlFlowInformation = { graph, breaks: lhs.breaks.concat(rhs.breaks), nexts: lhs.nexts.concat(rhs.nexts), returns: lhs.returns.concat(rhs.returns), entryPoints: [binId], exitPoints: [CfgVertex.toExitId(binId)] };

	graph.addVertex(CfgVertex.makeExprOrStm(binId, binOp.flavor === 'assignment' ? CfgVertexType.Statement : CfgVertexType.Expression, { end: [CfgVertex.toExitId(binId)] }));
	graph.addVertex(CfgVertex.makeExitMarker(binId));

	for(const exitPoint of lhs.exitPoints) {
		for(const entryPoint of rhs.entryPoints) {
			result.graph.addEdge(entryPoint, exitPoint, CfgEdge.makeFd());
		}
	}
	for(const entryPoint of lhs.entryPoints) {
		graph.addEdge(entryPoint, binId, CfgEdge.makeFd());
	}
	for(const exitPoint of rhs.exitPoints) {
		graph.addEdge(CfgVertex.toExitId(binId), exitPoint, CfgEdge.makeFd());
	}

	return result;
}

function cfgAccess(access: RAccess<ParentInformation>, name: ControlFlowInformation, accessors: readonly (ControlFlowInformation | typeof EmptyArgument)[]): ControlFlowInformation {
	const result = { ...name };
	const graph = result.graph;
	const accessId = access.info.id;
	graph.addVertex(CfgVertex.makeExpressionWithEnd(accessId, { mid: name.exitPoints }));
	result.entryPoints = [accessId];

	for(const entry of name.entryPoints) {
		graph.addEdge(entry, accessId, CfgEdge.makeFd());
	}

	result.exitPoints = name.exitPoints;

	for(const accessor of accessors) {
		if(accessor === EmptyArgument) {
			continue;
		}
		graph.mergeWith(accessor.graph);
		for(const exitPoint of result.exitPoints) {
			for(const entry of accessor.entryPoints) {
				graph.addEdge(entry, exitPoint, CfgEdge.makeFd());
			}
		}
		result.exitPoints = accessor.exitPoints;
		result.breaks = result.breaks.concat(accessor.breaks);
		result.nexts = result.nexts.concat(accessor.nexts);
		result.returns = result.returns.concat(accessor.returns);
	}
	for(const exitPoint of result.exitPoints) {
		graph.addEdge(CfgVertex.toExitId(accessId), exitPoint, CfgEdge.makeFd());
	}
	graph.addVertex(CfgVertex.makeExitMarker(accessId));
	result.exitPoints = [CfgVertex.toExitId(accessId)];
	return result;
}

// TODO: simplify exit marker style!
function cfgUnaryOp(unary: RNodeWithParent, operand: ControlFlowInformation): ControlFlowInformation {
	const graph = operand.graph;
	const unaryId = unary.info.id;
	graph.addVertex(CfgVertex.makeMarker(unaryId, unaryId));
	for(const entry of operand.exitPoints) {
		graph.addEdge(unaryId, entry, CfgEdge.makeFd());
	}

	return { ...operand, graph, exitPoints: [unaryId] };
}


function cfgExprList(node: RExpressionList<ParentInformation>, _grouping: unknown, expressions: ControlFlowInformation[]): ControlFlowInformation {
	const nodeId = node.info.id;
	const result: ControlFlowInformation = {
		graph:       new ControlFlowGraph(),
		breaks:      [],
		nexts:       [],
		returns:     [],
		exitPoints:  [nodeId],
		entryPoints: [nodeId]
	};
	const vtx = CfgVertex.makeExpression(nodeId);
	result.graph.addVertex(vtx);

	for(const expression of expressions) {
		for(const previousExitPoint of result.exitPoints) {
			for(const entryPoint of expression.entryPoints) {
				result.graph.addEdge(entryPoint, previousExitPoint, CfgEdge.makeFd());
			}
		}
		result.graph.mergeWith(expression.graph);
		result.breaks = result.breaks.concat(expression.breaks);
		result.nexts = result.nexts.concat(expression.nexts);
		result.returns = result.returns.concat(expression.returns);
		result.exitPoints = expression.exitPoints;
	}

	if(result.exitPoints.length > 0) {
		result.graph.addVertex(CfgVertex.makeExitMarker(nodeId));
		CfgVertex.setEnd(vtx, [CfgVertex.toExitId(nodeId)]);
	}

	for(const exit of result.exitPoints) {
		result.graph.addEdge(CfgVertex.toExitId(nodeId), exit, CfgEdge.makeFd());
	}
	result.exitPoints = result.exitPoints.length > 0 ? [CfgVertex.toExitId(nodeId)] : [];
	return result;
}


/**
 * Convert a cfg to RDF quads.
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
				children: CfgVertex.getChildren(v)
			})),
		edges: [...cfg.graph.edges()].flatMap(([fromId, targets]) =>
			[...targets].map(([toId, info]) => ({
				from: fromId,
				to:   toId,
				type: CfgEdge.getType(info),
				when: CfgEdge.getWhen(info)
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
