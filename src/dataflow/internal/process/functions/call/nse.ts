import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RUnaryOp } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { EmptyArgument, RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../../../../environments/identifier';
import { DataMaskingFunctionNames } from '../../../../environments/data-masking-functions';
import type { DataflowGraph } from '../../../../graph/graph';
import { type DataflowGraphVertexInfo, UseVertex } from '../../../../graph/vertex';
import { DfEdge, EdgeType } from '../../../../graph/edge';

/** The escape a quoting function offers, a property of the function: `quote(!!x)` negates, `expr(!!x)` splices. */
export enum Unquote {
	/** no escape at all, everything within the argument stays unevaluated */
	None   = 'none',
	/** rlang's `!!` and `!!!` splice in the value of their operand */
	Rlang  = 'rlang',
	/** `bquote`'s `.(x)` evaluates its operand */
	Bquote = 'bquote'
}

/** `!!x` parses as `!(!x)`, so peel the run of `!` to reach the operand. */
function unquotedOperandOf<Info>(node: RNode<Info>, style: Unquote): RNode<Info> | undefined {
	if(style === Unquote.Bquote) {
		if(!RFunctionCall.isNamed(node) || Identifier.getName(node.functionName.content) !== '.' || node.arguments.length !== 1) {
			return undefined;
		}
		const arg = node.arguments[0];
		return arg === EmptyArgument ? undefined : arg.value;
	}
	if(!isNegation(node) || !isNegation(node.operand)) {
		return undefined;
	}
	let operand: RNode<Info> = node.operand;
	while(isNegation(operand)) {
		operand = operand.operand;
	}
	return operand;
}

function isNegation<Info>(node: RNode<Info>): node is RUnaryOp<Info> {
	return RUnaryOp.is(node) && node.operator === '!';
}

/** The parts of a call R does not evaluate the standard way. */
export const Nse = {
	name: 'Nse',
	/** The ids an {@link Unquote} escape hands back to standard evaluation, the markers themselves excluded. */
	unquoted<Info extends ParentInformation>(this: void, root: RNode<Info> | undefined, style: Unquote): ReadonlySet<NodeId> | undefined {
		if(root === undefined || style === Unquote.None) {
			return undefined;
		}
		const evaluated = new Set<NodeId>();
		RNode.visitAst<Info>(root, node => {
			const operand = unquotedOperandOf(node, style);
			if(operand === undefined) {
				return false;
			}
			RNode.visitAst<Info>(operand, inner => {
				evaluated.add(inner.info.id);
				return false;
			});
			return true;
		});
		return evaluated.size > 0 ? evaluated : undefined;
	},

	/** Whether everything below `node` is unquoted. */
	isUnquote<Info>(this: void, node: RNode<Info>, style: Unquote): boolean {
		return style !== Unquote.None && unquotedOperandOf(node, style) !== undefined;
	},

	/** Drops the mask mark from names the caller binds: while `filter(d, k)` is processed `k` has no read yet. */
	dropResolvedMask(this: void, graph: DataflowGraph, id: NodeId, name: Identifier): void {
		if(DataMaskingFunctionNames.has(Identifier.getName(name))) {
			Nse.unmark(graph, id, target => !Nse.suppliedByMask(graph, target));
		}
	},

	/** Drops the non-standard-evaluation mark from the outgoing edges of `id` that `which` accepts. */
	unmark(this: void, graph: DataflowGraph, id: NodeId, which: (target: NodeId) => boolean = () => true): void {
		const edges = graph.outgoingEdges(id);
		for(const [target, edge] of edges ?? []) {
			if(DfEdge.includesType(edge, EdgeType.NonStandardEvaluation) && which(target)) {
				graph.removeEdgeType(id, target, EdgeType.NonStandardEvaluation);
			}
		}
	},

	/** Whether `id` is a name the data mask supplies, i.e. a use the caller does not bind itself. */
	suppliedByMask(this: void, graph: DataflowGraph, id: NodeId, vertex: DataflowGraphVertexInfo | undefined = graph.getVertex(id)): boolean {
		return UseVertex.is(vertex) && !graph.outgoingEdges(id)?.values().some(e => DfEdge.includesType(e, EdgeType.Reads));
	}
} as const;
