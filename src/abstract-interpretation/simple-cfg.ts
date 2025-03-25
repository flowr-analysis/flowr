import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionCall , EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { ParentInformation, NormalizedAst, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FoldFunctions } from '../r-bridge/lang-4.x/ast/model/processing/fold';
import { foldAst } from '../r-bridge/lang-4.x/ast/model/processing/fold';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import type { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { RTrue, RFalse } from '../r-bridge/lang-4.x/convert-values';
import type { CfgEdge, CfgVertex, ControlFlowInformation } from '../util/cfg/cfg';
import { CfgVertexType, ControlFlowGraph } from '../util/cfg/cfg';

export enum SimpleCfgVertexType {
    Expression = 'expression',
    IfThenElse = 'if-then-else',
    ForLoop = 'for-loop',
    RepeatLoop = 'repeat-loop',
    WhileLoop = 'while-loop',
    Break = 'break',
    Next = 'next'
}

export interface SimpleCfgVertex extends CfgVertex {
    name: RType,
    tag:  SimpleCfgVertexType
}

export class SimpleControlFlowGraph extends ControlFlowGraph {
	addVertex(vertex: SimpleCfgVertex, rootVertex = true): this {
		super.addVertex(vertex, rootVertex);
		return this;
	}

	vertices(): ReadonlyMap<NodeId, SimpleCfgVertex> {
		return super.vertices() as ReadonlyMap<NodeId, SimpleCfgVertex>;
	}
}

export interface SimpleControlFlowInformation extends ControlFlowInformation {
	graph: SimpleControlFlowGraph
}

const cfgFolds: FoldFunctions<ParentInformation, SimpleControlFlowInformation> = {
	foldNumber:   cfgLeaf,
	foldString:   cfgLeaf,
	foldLogical:  cfgLeaf,
	foldSymbol:   cfgLeaf,
	foldAccess:   cfgLeaf,
	foldBinaryOp: cfgLeaf,
	foldPipe:     cfgLeaf,
	foldUnaryOp:  cfgLeaf,
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
		foldParameter:          cfgLeaf,
		foldArgument:           cfgLeaf
	}
};

export function extractSimpleCFG<Info = ParentInformation>(ast: NormalizedAst<Info>): SimpleControlFlowInformation {
	return foldAst(ast.ast, cfgFolds);
}

function cfgLeaf(leaf: RNodeWithParent): SimpleControlFlowInformation {
	// We are only interested in actual expressions in an expression list
	if(leaf.info.role === RoleInParent.ExpressionListChild) {
		const graph = new SimpleControlFlowGraph();
		const vertex: SimpleCfgVertex = { id: leaf.info.id, name: leaf.type, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression };
		graph.addVertex(vertex);

		return { graph, breaks: [], nexts: [], returns: [], entryPoints: [leaf.info.id], exitPoints: [leaf.info.id] };
	}
	return cfgIgnore(leaf);
}

function cfgBreak(leaf: RNodeWithParent): SimpleControlFlowInformation {
	const graph = new SimpleControlFlowGraph();
	const vertex: SimpleCfgVertex = { id: leaf.info.id, name: leaf.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.Break };
	graph.addVertex(vertex);

	return { graph, breaks: [leaf.info.id], nexts: [], returns: [], entryPoints: [leaf.info.id], exitPoints: [] };
}

function cfgNext(leaf: RNodeWithParent): SimpleControlFlowInformation {
	const graph = new SimpleControlFlowGraph();
	const vertex: SimpleCfgVertex = { id: leaf.info.id, name: leaf.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.Next };
	graph.addVertex(vertex);

	return { graph, breaks: [], nexts: [leaf.info.id], returns: [], entryPoints: [leaf.info.id], exitPoints: [] };
}

function cfgIgnore(_leaf: RNodeWithParent): SimpleControlFlowInformation {
	return { graph: new SimpleControlFlowGraph(), breaks: [], nexts: [], returns: [], entryPoints: [], exitPoints: [] };
}

function cfgIfThenElse(ifNode: RNodeWithParent, _condition: SimpleControlFlowInformation, then: SimpleControlFlowInformation, otherwise: SimpleControlFlowInformation | undefined): SimpleControlFlowInformation {
	const graph = then.graph;
	const vertex: SimpleCfgVertex = { id: ifNode.info.id, name: ifNode.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse };
	graph.addVertex(vertex);

	if(otherwise) {
		graph.merge(otherwise.graph);
	}

	for(const entryPoint of then.entryPoints) {
		graph.addEdge(ifNode.info.id, entryPoint, { label: 'CD', when: RTrue, caused: ifNode.info.id });
	}
	for(const entryPoint of otherwise?.entryPoints ?? []) {
		graph.addEdge(ifNode.info.id, entryPoint, { label: 'CD', when: RFalse, caused: ifNode.info.id });
	}
	const exitPoints = [...then.exitPoints, ...otherwise?.exitPoints ?? []];

	// add if node as exit point if body is empty
	if(then.exitPoints.length === 0 || otherwise == undefined || otherwise.exitPoints.length === 0) {
		exitPoints.push(ifNode.info.id);
	}

	return {
		graph,
		breaks:      [...then.breaks, ...otherwise?.breaks ?? []],
		nexts:       [...then.nexts, ...otherwise?.nexts ?? []],
		returns:     [...then.returns, ...otherwise?.returns ?? []],
		entryPoints: [ifNode.info.id],
		exitPoints:  exitPoints
	};
}

function cfgRepeat(repeat: RRepeatLoop<ParentInformation>, body: SimpleControlFlowInformation): SimpleControlFlowInformation {
	const graph = body.graph;
	const vertex: SimpleCfgVertex = { id: repeat.info.id, name: repeat.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.RepeatLoop };
	graph.addVertex(vertex);

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(repeat.info.id, entryPoint, { label: 'FD' });
	}
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(next, repeat.info.id, { label: 'FD' });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, entryPoints: [repeat.info.id], exitPoints: [...body.breaks] };
}

function cfgWhile(whileLoop: RWhileLoop<ParentInformation>, _condition: SimpleControlFlowInformation, body: SimpleControlFlowInformation): SimpleControlFlowInformation {
	const graph = body.graph;
	const vertex: SimpleCfgVertex = { id: whileLoop.info.id, name: whileLoop.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.WhileLoop };
	graph.addVertex(vertex);

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(whileLoop.info.id, entryPoint, { label: 'CD', when: RTrue, caused: whileLoop.info.id });
	}
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(next, whileLoop.info.id, { label: 'FD' });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, entryPoints: [whileLoop.info.id], exitPoints: [...body.breaks, whileLoop.info.id] };
}

function cfgFor(forLoop: RForLoop<ParentInformation>, _variable: SimpleControlFlowInformation, _vector: SimpleControlFlowInformation, body: SimpleControlFlowInformation): SimpleControlFlowInformation {
	const graph = body.graph;
	const vertex: SimpleCfgVertex = { id: forLoop.info.id, name: forLoop.type, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.ForLoop };
	graph.addVertex(vertex);

	for(const entryPoint of body.entryPoints) {
		graph.addEdge(forLoop.info.id, entryPoint, { label: 'CD', when: RTrue, caused: forLoop.info.id });
	}
	for(const next of [...body.nexts, ...body.exitPoints]) {
		graph.addEdge(next, forLoop.info.id, { label: 'FD' });
	}

	return { graph, breaks: [], nexts: [], returns: body.returns, entryPoints: [forLoop.info.id], exitPoints: [...body.breaks, forLoop.info.id] };
}

function cfgFunctionDefinition(fn: RFunctionDefinition<ParentInformation>, _params: SimpleControlFlowInformation[], _body: SimpleControlFlowInformation): SimpleControlFlowInformation {
	// skip function definitions for now
	return cfgIgnore(fn);
}

function cfgFunctionCall(call: RFunctionCall<ParentInformation>, _name: SimpleControlFlowInformation, _args: (SimpleControlFlowInformation | typeof EmptyArgument)[]): SimpleControlFlowInformation {
	// no resolve for function call targets to track function definitions for now
	return cfgLeaf(call);
}

function cfgExprList(_node: RNodeWithParent, _grouping: unknown, expressions: SimpleControlFlowInformation[]): SimpleControlFlowInformation {
	const result: SimpleControlFlowInformation = { graph: new SimpleControlFlowGraph(), breaks: [], nexts: [], returns: [], entryPoints: [], exitPoints: [] };
	let first = true;

	for(const expression of expressions) {
		if(first) {
			result.entryPoints = expression.entryPoints;
			first = false;
		} else {
			for(const prevExitPoint of result.exitPoints) {
				for(const entryPoint of expression.entryPoints) {
					result.graph.addEdge(prevExitPoint, entryPoint, createEdge(result.graph, prevExitPoint));
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

function createEdge(graph: SimpleControlFlowGraph, prev: NodeId): CfgEdge {
	const prevVertex = graph.vertices().get(prev);

	if(prevVertex?.tag === SimpleCfgVertexType.IfThenElse) {
		const outgoing = graph.outgoing(prev)?.values().toArray();

		if(outgoing?.some(edge => edge.when === 'TRUE') && !outgoing.some(edge => edge.when === 'FALSE')) {
			return { label: 'CD', when: 'FALSE', caused: prev };
		} else if(outgoing?.some(edge => edge.when === 'FALSE') && !outgoing.some(edge => edge.when === 'TRUE')) {
			return { label: 'CD', when: 'TRUE', caused: prev };
		}
	} else if(prevVertex?.tag === SimpleCfgVertexType.WhileLoop || prevVertex?.tag === SimpleCfgVertexType.ForLoop) {
		return { label: 'CD', when: 'FALSE', caused: prev };
	}
	return { label: 'FD' };
}
