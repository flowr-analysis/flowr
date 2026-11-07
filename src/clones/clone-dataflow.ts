import { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { Identifier } from '../dataflow/environments/identifier';
import { FunctionSemantics } from '../dataflow/fn/function-semantics';
import { callFnProps } from '../dataflow/environments/query-fn-props';
import { CallProp } from '../dataflow/environments/built-in-props';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { REnvironmentInformation } from '../dataflow/environments/environment';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import type { AstIdMap, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { assignmentOperator, type InlinePlan } from './clone-ast';
import { DfgVertex } from '../dataflow/graph/vertex';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';


/** the single read of the definition `def`, if the dataflow graph knows exactly one and it reads nothing else */
function singleUse(graph: DataflowGraph, def: NodeId): NodeId | undefined {
	let use: NodeId | undefined;
	for(const [source, edge] of graph.edgesTo(def)) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			if(use !== undefined) {
				return undefined;
			}
			use = source;
		}
	}
	if(use === undefined) {
		return undefined;
	}
	for(const [target, edge] of graph.edgesFrom(use)) {
		if(target !== def && DfEdge.includesType(edge, EdgeType.Reads)) {
			return undefined;
		}
	}
	return use;
}

/**
 * The statement of `list` that contains `node`, if evaluating `node` happens exactly once whenever that statement
 * runs: not within a nested function (a closure), a loop body or condition, or a branch of an `if` (its condition and
 * the vector of a `for` are evaluated once, so they are fine).
 */
function statementWithin(node: RNodeWithParent, list: NodeId, idMap: AstIdMap): RNodeWithParent | undefined {
	let current: RNodeWithParent = node;
	while(current.info.parent !== list) {
		const parent = current.info.parent === undefined ? undefined : idMap.get(current.info.parent);
		if(parent === undefined || RFunctionDefinition.is(parent) || RWhileLoop.is(parent) || RRepeatLoop.is(parent)
			|| (RForLoop.is(parent) && current !== parent.vector) || (RIfThenElse.is(parent) && current !== parent.condition)) {
			return undefined;
		}
		current = parent;
	}
	return current;
}

/** the names of the variables `value` reads, and whether all calls in it are pure (`environment` knows the configured built-ins) */
function readsOf(value: RNodeWithParent, graph: DataflowGraph, environment: REnvironmentInformation | undefined): { names: Set<string>, pure: boolean } {
	const names = new Set<string>();
	let pure = true;
	RNode.visitAst(value, n => {
		if(RSymbol.is(n)) {
			names.add(Identifier.getName(n.content));
		} else if(RFunctionCall.is(n) || RBinaryOp.is(n) || RUnaryOp.is(n) || RAccess.is(n)) {
			pure &&= FunctionSemantics.call.props.hasAny(callFnProps(n.info.id, graph, environment), CallProp.Pure);
		}
	});
	return { names, pure };
}

/** whether one of the statements assigns one of `names` */
function assignsAny(statements: readonly RNodeWithParent[], names: ReadonlySet<string>): boolean {
	let found = false;
	RNode.visitAst(statements, n => {
		const assign = RBinaryOp.is(n) ? assignmentOperator(n.operator) : undefined;
		if(assign && RBinaryOp.is(n)) {
			const target = assign.right ? n.rhs : n.lhs;
			found ||= RSymbol.is(target) && names.has(Identifier.getName(target.content));
		}
		return found;
	});
	return found;
}

/**
 * Plans the `dataflow` perspective: a local assignment statement `x <- e` whose definition of `x` the dataflow
 * graph sees read exactly once, by a read that sees no other definition, is evaluated exactly once in a later
 * statement of the same block, and with nothing in between that could change `e` (an impure `e` must be next to its
 * use, a pure one must not have its variables reassigned in between), is dropped and `e` takes the place of that read.
 * Function definitions are never inlined, as they are units of their own.
 * `environment`, that of the analysis, knows the configured built-ins.
 */
export function planInlining(graph: DataflowGraph, idMap: AstIdMap, environment?: REnvironmentInformation): InlinePlan {
	const replace = new Map<NodeId, RNodeWithParent>();
	const drop = new Set<NodeId>();
	for(const node of idMap.values()) {
		const assign = RBinaryOp.is(node) ? assignmentOperator(node.operator) : undefined;
		if(!RBinaryOp.is(node) || !assign || assign.super || !DfgVertex.hasOrigin(graph.getVertex(node.info.id), BuiltInProcName.Assignment)) {
			continue;
		}
		const [target, value] = assign.right ? [node.rhs, node.lhs] : [node.lhs, node.rhs];
		const list = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
		if(!RSymbol.is(target) || RFunctionDefinition.is(value) || !RExpressionList.is(list)) {
			continue;
		}
		const use = singleUse(graph, target.info.id);
		const useNode = use === undefined ? undefined : idMap.get(use);
		if(!RSymbol.is(useNode)) {
			continue;
		}
		const statement = statementWithin(useNode, list.info.id, idMap);
		const from = list.children.indexOf(node), to = statement === undefined ? -1 : list.children.indexOf(statement);
		if(to <= from) {
			continue;
		}
		/* moving `e` past other statements must not change what it computes or when its effects happen */
		const between = list.children.slice(from + 1, to);
		if(between.length > 0) {
			const reads = readsOf(value, graph, environment);
			if(!reads.pure || assignsAny(between, reads.names)) {
				continue;
			}
		}
		replace.set(useNode.info.id, value);
		drop.add(node.info.id);
	}
	return { replace, drop };
}
