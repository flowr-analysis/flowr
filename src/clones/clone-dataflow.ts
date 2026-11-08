import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
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

const CallTypes: ReadonlySet<RType> = new Set([RType.FunctionCall, RType.BinaryOp, RType.UnaryOp, RType.Access]);

/** the single read of the definition `def`, if there is exactly one and it reads nothing else */
function singleUse(graph: DataflowGraph, def: NodeId): NodeId | undefined {
	const reads = (edges: Iterable<[NodeId, DfEdge]>) => [...edges].filter(([, e]) => DfEdge.includesType(e, EdgeType.Reads)).map(([id]) => id);
	const [use, ...more] = reads(graph.edgesTo(def));
	return use !== undefined && more.length === 0 && reads(graph.edgesFrom(use)).every(t => t === def) ? use : undefined;
}

/** the statement of `list` containing `node` if it evaluates `node` exactly once: not within a closure, loop, or branch */
function statementWithin(node: RNodeWithParent, list: NodeId, idMap: AstIdMap): RNodeWithParent | undefined {
	let current = node;
	while(current.info.parent !== list) {
		const parent = RNode.directParent(current, idMap);
		if(parent === undefined || RFunctionDefinition.is(parent) || RWhileLoop.is(parent) || RRepeatLoop.is(parent)
			|| (RForLoop.is(parent) && current !== parent.vector) || (RIfThenElse.is(parent) && current !== parent.condition)) {
			return undefined;
		}
		current = parent;
	}
	return current;
}

/** the names assigned (or read, with `assigned = false`) in `nodes`, and whether all calls in them are pure */
function namesOf(nodes: RNodeWithParent | readonly RNodeWithParent[], assigned: boolean, graph: DataflowGraph, environment: REnvironmentInformation | undefined): { names: Set<string>, pure: boolean } {
	const names = new Set<string>();
	let pure = true;
	RNode.visitAst(nodes, n => {
		const assign = RBinaryOp.is(n) ? assignmentOperator(n.operator) : undefined;
		const symbol = assigned ? (assign && RBinaryOp.is(n) ? (assign.right ? n.rhs : n.lhs) : undefined) : n;
		if(RSymbol.is(symbol)) {
			names.add(Identifier.getName(symbol.content));
		}
		if(!assigned && CallTypes.has(n.type)) {
			pure &&= FunctionSemantics.call.props.hasAny(callFnProps(n.info.id, graph, environment), CallProp.Pure);
		}
	});
	return { names, pure };
}

/**
 * Plans the `dataflow` perspective: a local assignment `x <- e` (no function) whose definition is read exactly once,
 * by a read seeing no other definition, evaluated exactly once in a later statement of the same block, is dropped and
 * `e` takes the place of the read, if nothing in between can change `e` (an impure `e` must be next to its use, a
 * pure one must not have its variables reassigned in between).
 */
export function planInlining(graph: DataflowGraph, idMap: AstIdMap, environment?: REnvironmentInformation): InlinePlan {
	const replace = new Map<NodeId, RNodeWithParent>();
	const drop = new Set<NodeId>();
	for(const node of idMap.values()) {
		const assign = RBinaryOp.is(node) ? assignmentOperator(node.operator) : undefined;
		const list = RNode.directParent(node, idMap);
		if(!RBinaryOp.is(node) || !assign || assign.super || !RExpressionList.is(list) || !DfgVertex.hasOrigin(graph.getVertex(node.info.id), BuiltInProcName.Assignment)) {
			continue;
		}
		const [target, value] = assign.right ? [node.rhs, node.lhs] : [node.lhs, node.rhs];
		const useId = RSymbol.is(target) && !RFunctionDefinition.is(value) ? singleUse(graph, target.info.id) : undefined;
		const use = useId === undefined ? undefined : idMap.get(useId);
		const statement = RSymbol.is(use) ? statementWithin(use, list.info.id, idMap) : undefined;
		const from = list.children.indexOf(node), to = statement ? list.children.indexOf(statement) : -1;
		const between = list.children.slice(from + 1, to);
		if(!use || to <= from) {
			continue;
		} else if(between.length > 0) {
			const reads = namesOf(value, false, graph, environment);
			if(!reads.pure || [...namesOf(between, true, graph, environment).names].some(n => reads.names.has(n))) {
				continue;
			}
		}
		replace.set(use.info.id, value);
		drop.add(node.info.id);
	}
	return { replace, drop };
}
