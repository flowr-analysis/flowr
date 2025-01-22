import type { MergeableRecord } from '../objects';
import { setEquals } from '../set';
import type { QuadSerializationConfiguration } from '../quads';
import { graph2quads } from '../quads';
import { log } from '../log';
import { jsonReplacer } from '../json';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FoldFunctions } from '../../r-bridge/lang-4.x/ast/model/processing/fold';
import { foldAst } from '../../r-bridge/lang-4.x/ast/model/processing/fold';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { RFalse, RTrue } from '../../r-bridge/lang-4.x/convert-values';
import type { RRepeatLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RWhileLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RForLoop } from '../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RPipe } from '../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { getAllFunctionCallTargets } from '../../dataflow/internal/linker';
import { isFunctionDefinitionVertex } from '../../dataflow/graph/vertex';

export const enum CfgVertexType {
	/** Marks a break point in a construct (e.g., between the name and the value of an argument, or the formals and the body of a function)  */
	MidMarker   = 'mid-marker',
	/** The explicit exit-nodes to ensure the hammock property */
	EndMarker   = 'end-marker',
	/** something like an if, assignment, ... even though in the classical sense of R they are still expressions */
	Statement   = 'statement',
	/** something like an addition, ... */
	Expression  = 'expression'
}

export interface CfgVertex {
	id:        NodeId
	type:      CfgVertexType,
	name:      string
	/** in case of a function definition */
	children?: NodeId[]
}

interface CfgFlowDependencyEdge extends MergeableRecord {
	label: 'FD'
}
interface CfgControlDependencyEdge extends MergeableRecord {
	label:  'CD'
	/** the id which caused the control dependency */
	caused: NodeId,
	when:   typeof RTrue | typeof RFalse
}

export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgVertex} and {@link CFG#rootVertexIds|rootVertexIds()}).
 */
export class ControlFlowGraph {
	private rootVertices:      Set<NodeId> = new Set<NodeId>();
	private vertexInformation: Map<NodeId, CfgVertex> = new Map<NodeId, CfgVertex>();
	private edgeInformation:   Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();

	addVertex(vertex: CfgVertex, rootVertex = true): this {
		if(this.vertexInformation.has(vertex.id)) {
			throw new Error(`Node with id ${vertex.id} already exists`);
		}
		this.vertexInformation.set(vertex.id, vertex);
		if(rootVertex) {
			this.rootVertices.add(vertex.id);
		}
		return this;
	}

	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		if(!this.edgeInformation.has(from)) {
			this.edgeInformation.set(from, new Map<NodeId, CfgEdge>());
		}
		this.edgeInformation.get(from)?.set(to, edge);
		return this;
	}

	outgoing(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		return this.edgeInformation.get(node);
	}

	rootVertexIds(): ReadonlySet<NodeId> {
		return this.rootVertices;
	}

	vertices(): ReadonlyMap<NodeId, CfgVertex> {
		return this.vertexInformation;
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>> {
		return this.edgeInformation;
	}

	merge(other: ControlFlowGraph, forceNested = false): this {
		for(const [id, node] of other.vertexInformation) {
			this.addVertex(node, forceNested ? false : other.rootVertices.has(id));
		}
		for(const [from, edges] of other.edgeInformation) {
			for(const [to, edge] of edges) {
				this.addEdge(from, to, edge);
			}
		}
		return this;
	}
}

export interface ControlFlowInformation extends MergeableRecord {
	returns:     NodeId[],
	breaks:      NodeId[],
	nexts:       NodeId[],
	/** intended to construct a hammock graph, with 0 exit points representing a block that should not be part of the CFG (like a comment) */
	entryPoints: NodeId[],
	/** See {@link ControlFlowInformation#entryPoints|entryPoints} */
	exitPoints:  NodeId[],
	graph:       ControlFlowGraph
}

export function emptyControlFlowInformation(): ControlFlowInformation {
	return {
		returns:     [],
		breaks:      [],
		nexts:       [],
		entryPoints: [],
		exitPoints:  [],
		graph:       new ControlFlowGraph()
	};
}

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

function cfgLeaf(type: CfgVertexType): (leaf: RNodeWithParent) => ControlFlowInformation {
	return (leaf: RNodeWithParent) => {
		const graph = new ControlFlowGraph();
		graph.addVertex({ id: leaf.info.id, name: leaf.type, type });
		return { graph, breaks: [], nexts: [], returns: [], exitPoints: [leaf.info.id], entryPoints: [leaf.info.id] };
	};
}

function cfgBreak(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(CfgVertexType.Statement)(leaf), breaks: [leaf.info.id] };
}

function cfgNext(leaf: RNodeWithParent): ControlFlowInformation {
	return { ...cfgLeaf(CfgVertexType.Statement)(leaf), nexts: [leaf.info.id] };
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
	graph.addVertex({ id: ifNode.info.id + '-exit', name: 'if-exit', type: CfgVertexType.EndMarker });
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
	graph.addVertex({ id: repeat.info.id + '-exit', name: 'repeat-exit', type: CfgVertexType.EndMarker });

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
	graph.addVertex({ id: whileLoop.info.id + '-exit', name: 'while-exit', type: CfgVertexType.EndMarker });

	graph.merge(body.graph);

	for(const entry of condition.entryPoints) {
		graph.addEdge(entry, whileLoop.info.id, { label: 'FD' });
	}

	for(const exit of condition.exitPoints) {
		for(const entry of body.entryPoints) {
			graph.addEdge(entry, exit, { label: 'CD', when: RTrue, caused: whileLoop.info.id });
		}
	}

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(whileLoop.info.id, entryPoint, { label: 'FD' });
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
	graph.addVertex({ id: forLoop.info.id + '-exit', name: 'for-exit', type: CfgVertexType.EndMarker });

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
	// while can break on the condition as well
	for(const exit of variable.exitPoints) {
		graph.addEdge(forLoop.info.id + '-exit', exit, { label: 'CD', when: RFalse, caused: forLoop.info.id });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, exitPoints: [forLoop.info.id + '-exit'], entryPoints: [forLoop.info.id] };
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, params: ControlFlowInformation[], body: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph();
	const children: NodeId[] = [fn.info.id + '-params', fn.info.id + '-exit'];
	graph.addVertex({ id: fn.info.id + '-params', name: 'function-parameters', type: CfgVertexType.MidMarker }, false);
	graph.addVertex({ id: fn.info.id + '-exit', name: 'function-exit', type: CfgVertexType.EndMarker }, false);
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

	graph.addVertex({ id: call.info.id + '-name', name: 'call-name', type: CfgVertexType.MidMarker });
	for(const exitPoint of name.exitPoints) {
		graph.addEdge(call.info.id + '-name', exitPoint, { label: 'FD' });
	}


	graph.addVertex({ id: call.info.id + '-exit', name: 'call-exit', type: CfgVertexType.EndMarker });

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
				type: CfgVertexType.EndMarker
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

	graph.addVertex({ id: node.info.id + '-before-value', name: 'before-value', type: CfgVertexType.MidMarker });
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

	graph.addVertex({ id: node.info.id + '-exit', name: 'exit', type: CfgVertexType.EndMarker });
	for(const exit of currentExitPoint) {
		graph.addEdge(node.info.id + '-exit', exit, { label: 'FD' });
	}

	return info;

}


function cfgBinaryOp(binOp: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: ControlFlowInformation, rhs: ControlFlowInformation): ControlFlowInformation {
	const graph = new ControlFlowGraph().merge(lhs.graph).merge(rhs.graph);
	const result: ControlFlowInformation = { graph, breaks: [...lhs.breaks, ...rhs.breaks], nexts: [...lhs.nexts, ...rhs.nexts], returns: [...lhs.returns, ...rhs.returns], entryPoints: [binOp.info.id], exitPoints: [binOp.info.id + '-exit'] };

	graph.addVertex({ id: binOp.info.id, name: binOp.type, type: binOp.flavor === 'assignment' ? CfgVertexType.Statement : CfgVertexType.Expression });
	graph.addVertex({ id: binOp.info.id + '-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker });

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
	const result = name;
	const graph = result.graph;
	graph.addVertex({ id: access.info.id, name: access.type, type: CfgVertexType.Expression });
	graph.addVertex({ id: access.info.id + '-exit', name: 'access-exit', type: CfgVertexType.EndMarker });
	for(const entry of name.entryPoints) {
		graph.addEdge(entry, access.info.id, { label: 'FD' });
	}
	for(const exit of name.exitPoints) {
		graph.addEdge(access.info.id, exit, { label: 'FD' });
	}
	result.entryPoints = [access.info.id];
	result.exitPoints = [access.info.id + '-exit'];
	for(const accessor of accessors) {
		if(accessor === EmptyArgument) {
			continue;
		}
		graph.merge(accessor.graph);
		for(const entry of accessor.entryPoints) {
			graph.addEdge(entry, access.info.id, { label: 'FD' });
		}
		for(const exit of accessor.exitPoints) {
			graph.addEdge(access.info.id + '-exit', exit, { label: 'FD' });
		}
	}
	return result;
}

function cfgUnaryOp(unary: RNodeWithParent, operand: ControlFlowInformation): ControlFlowInformation {
	const graph = operand.graph;
	graph.addVertex({ id: unary.info.id, name: unary.type, type: CfgVertexType.EndMarker });
	for(const entry of operand.exitPoints) {
		graph.addEdge(unary.info.id, entry, { label: 'FD' });
	}

	return { ...operand, graph, exitPoints: [unary.info.id] };
}


function cfgExprList(_node: RNodeWithParent, _grouping: unknown, expressions: ControlFlowInformation[]): ControlFlowInformation {
	const result: ControlFlowInformation = { graph: new ControlFlowGraph(), breaks: [], nexts: [], returns: [], exitPoints: [], entryPoints: [] };
	let first = true;
	for(const expression of expressions) {
		if(first) {
			result.entryPoints = expression.entryPoints;
			first = false;
		} else {
			for(const previousExitPoint of result.exitPoints) {
				for(const entryPoint of expression.entryPoints) {
					result.graph.addEdge(entryPoint, previousExitPoint, { label: 'FD' });
				}
			}
		}
		result.graph.merge(expression.graph);
		result.breaks.push(...expression.breaks);
		result.nexts.push(...expression.nexts);
		result.returns.push(...expression.returns);
		result.exitPoints = expression.exitPoints;
	}
	return result;
}

function equalChildren(a: NodeId[] | undefined, b: NodeId[] | undefined): boolean {
	if(!a || !b || a.length !== b.length) {
		return false;
	}
	for(let i = 0; i < a.length; ++i) {
		if(a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Returns true if the given CFG equals the other CFG. False otherwise.
 */
export function equalCfg(a: ControlFlowGraph | undefined, b: ControlFlowGraph | undefined): boolean {
	if(!a || !b) {
		return a === b;
	} else if(!setEquals(a.rootVertexIds(), b.rootVertexIds())) {
		log.debug(`root vertex ids differ ${JSON.stringify(a.rootVertexIds(), jsonReplacer)} vs. ${JSON.stringify(b.rootVertexIds(), jsonReplacer)}.`);
		return false;
	}

	const aVert = a.vertices();
	const bVert = b.vertices();
	if(aVert.size !== bVert.size) {
		log.debug(`vertex count differs ${aVert.size} vs. ${bVert.size}.`);
		return false;
	}
	for(const [id, aInfo] of aVert) {
		const bInfo = bVert.get(id);
		if(bInfo === undefined || aInfo.name !== bInfo.name || equalChildren(aInfo.children, bInfo.children)) {
			log.debug(`vertex ${id} differs ${JSON.stringify(aInfo, jsonReplacer)} vs. ${JSON.stringify(bInfo, jsonReplacer)}.`);
			return false;
		}
	}

	const aEdges = a.edges();
	const bEdges = b.edges();
	if(aEdges.size !== bEdges.size) {
		log.debug(`edge count differs ${aEdges.size} vs. ${bEdges.size}.`);
		return false;
	}
	for(const [from, aTo] of aEdges) {
		const bTo = bEdges.get(from);
		if(bTo === undefined || aTo.size !== bTo.size) {
			log.debug(`edge count for ${from} differs ${aTo.size} vs. ${bTo?.size ?? '?'}.`);
			return false;
		}
		for(const [to, aEdge] of aTo) {
			const bEdge = bTo.get(to);
			if(bEdge === undefined || aEdge.label !== bEdge.label) {
				log.debug(`edge ${from} -> ${to} differs ${JSON.stringify(aEdge, jsonReplacer)} vs. ${JSON.stringify(bEdge, jsonReplacer)}.`);
				return false;
			}
		}
	}

	return true;
}


/**
 * @see df2quads
 * @see serialize2quads
 * @see graph2quads
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
