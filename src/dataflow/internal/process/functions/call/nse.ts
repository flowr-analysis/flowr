import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RUnaryOp } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { EmptyArgument, RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../../../../environments/identifier';
import { DataMaskingFunctionNames } from '../../../../environments/data-masking-functions';
import { NoEdges, type DataflowGraph } from '../../../../graph/graph';
import { type DataflowGraphVertexInfo, FunctionCallVertex, FunctionDefinitionVertex, UseVertex, VariableDefinitionVertex } from '../../../../graph/vertex';
import { DfEdge, EdgeType } from '../../../../graph/edge';
import { RArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

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
		return RArgument.isEmpty(arg) ? undefined : arg.value;
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

/**
 * Whether the definition is a bare function: the vertex itself, or a variable bound straight to a function
 * definition. A binding that anything was done to on the way (`structure(f, class = "cls")`, `class(f) <- `)
 * is not one, and deliberately so: such a closure carries a class, `>` may dispatch on it, and flowR cannot
 * tell that it does not. Only where nothing at all can be attached is a function ruled out as an operand.
 */
function definesAFunction(graph: DataflowGraph, id: NodeId): boolean {
	if(NodeId.isBuiltIn(id)) {
		return true;
	}
	const vertex = graph.getVertex(id);
	if(FunctionDefinitionVertex.is(vertex)) {
		return true;
	} else if(!VariableDefinitionVertex.is(vertex)) {
		return false;
	}
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
		if(DfEdge.includesType(edge, EdgeType.DefinedBy) && FunctionDefinitionVertex.is(graph.getVertex(target))) {
			return true;
		}
	}
	return false;
}

/**
 * Whether `id` reads something and everything it reads is a bare function. In a data mask such a name is a
 * column after all: R asks the data first, and a plain closure is not what `id > 2` compares. A closure that
 * was given a class is left alone, see {@link definesAFunction}.
 */
function readsOnlyFunctions(graph: DataflowGraph, id: NodeId): boolean {
	let reads = false;
	for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
		if(!DfEdge.includesType(edge, EdgeType.Reads)) {
			continue;
		} else if(!definesAFunction(graph, target)) {
			return false;
		}
		reads = true;
	}
	return reads;
}

/**
 * A call that hands its arguments a data mask, with the names in that mask the caller binds itself.
 * Those mean the column as much as the binding, so {@link Nse.linkMasksToData} links them to the data too.
 */
export interface MaskingCall {
	readonly id:    NodeId
	readonly bound: readonly NodeId[]
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

	/**
	 * Drops the mask mark from names the caller binds to a value: while `filter(d, k)` is processed `k` has no
	 * read yet. A name bound to a function keeps its mark, as `filter(d, id > 2)` next to `id <- function(...)`
	 * still means the column. Hands back the masking call and the names it just unmarked, `undefined` when
	 * `name` does not mask at all, so {@link linkMasksToData} need not ask a second time.
	 */
	dropResolvedMask(this: void, graph: DataflowGraph, id: NodeId, name: Identifier): MaskingCall | undefined {
		if(!DataMaskingFunctionNames.has(Identifier.getName(name))) {
			return undefined;
		}
		return { id, bound: Nse.unmark(graph, id, target => !Nse.suppliedByMask(graph, target) && !readsOnlyFunctions(graph, target)) };
	},

	/** Drops the non-standard-evaluation mark from the outgoing edges of `id` that `which` accepts, and reports them. */
	unmark(this: void, graph: DataflowGraph, id: NodeId, which: (target: NodeId) => boolean = () => true): NodeId[] {
		const dropped: NodeId[] = [];
		for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
			if(DfEdge.includesType(edge, EdgeType.NonStandardEvaluation) && which(target)) {
				graph.removeEdgeType(id, target, EdgeType.NonStandardEvaluation);
				dropped.push(target);
			}
		}
		return dropped;
	},

	/** Whether the vertex is a name a data mask may supply, which is every name appearing in the mask. */
	maskCandidate(this: void, vertex: DataflowGraphVertexInfo | undefined): boolean {
		return UseVertex.is(vertex);
	},

	/** Whether `id` is a name the data mask supplies, i.e. a use the caller does not bind itself. */
	suppliedByMask(this: void, graph: DataflowGraph, id: NodeId, vertex: DataflowGraphVertexInfo | undefined = graph.getVertex(id)): boolean {
		return UseVertex.is(vertex) && !graph.outgoingEdges(id)?.values().some(e => DfEdge.includesType(e, EdgeType.Reads));
	},

	/**
	 * Whether `id` is a name a data mask supplied, which the mark the masking call carries is what records.
	 * Unlike {@link suppliedByMask} this survives {@link linkMasksToData}, so ask this one after the dataflow
	 * is complete and that one while a call is still being processed.
	 */
	maskedName(this: void, graph: DataflowGraph, id: NodeId): boolean {
		for(const [source, edge] of graph.ingoingEdges(id) ?? NoEdges) {
			const call = DfEdge.includesType(edge, EdgeType.NonStandardEvaluation) ? graph.getVertex(source) : undefined;
			if(FunctionCallVertex.is(call) && call.name !== undefined && DataMaskingFunctionNames.has(Identifier.getName(call.name))) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Links every name the data masks of `calls` supply to the data it comes from: `id` in `filter(df, id > 2)`
	 * is a column of `df`, so it reads `df`. Run once every mark has settled, as adding the read makes
	 * {@link suppliedByMask} false for the name; a call whose first argument is masked too has no data to link
	 * against.
	 */
	linkMasksToData(this: void, graph: DataflowGraph, calls: readonly MaskingCall[]): void {
		const links: [from: NodeId, to: NodeId][] = [];
		for(const { id, bound } of calls) {
			const call = graph.getVertex(id);
			const data = FunctionCallVertex.is(call) ? call.args.find(a => a !== EmptyArgument) : undefined;
			if(data === undefined) {
				continue;
			}
			/* what is still marked are the names the data supplies, the unmarked ones mean the binding too */
			const masked = new Set(bound);
			for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
				if(DfEdge.includesType(edge, EdgeType.NonStandardEvaluation)) {
					masked.add(target);
				}
			}
			/* a call masking its first argument too, like `aes(x, y)`, has no data to link against */
			if(masked.has(data.nodeId)) {
				continue;
			}
			for(const target of masked) {
				/* a function of that name is not what the mask means, so the column takes its place */
				if(readsOnlyFunctions(graph, target)) {
					for(const [definition, edge] of graph.outgoingEdges(target) ?? NoEdges) {
						if(DfEdge.includesType(edge, EdgeType.Reads)) {
							graph.removeEdgeType(target, definition, EdgeType.Reads);
						}
					}
				}
				links.push([target, data.nodeId]);
			}
		}
		for(const [from, to] of links) {
			graph.addEdge(from, to, EdgeType.Reads);
		}
	}
} as const;
