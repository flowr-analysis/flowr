import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { DataflowGraph, FunctionArgument } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexArgument, DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { ResolvedTaint } from '../taint-resolve';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { SourceLocation } from '../../util/range';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AbsintContext } from '../../abstract-interpretation/abstract-semantics';
import type { StateDomain } from '../../abstract-interpretation/domains/state-domain';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { EdgeType } from '../../dataflow/graph/edge';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { uniqueArray } from '../../util/collections/arrays';
import { DefaultMap } from '../../util/collections/defaultmap';
import type { TaintCallResolution, TaintProvenanceGraph } from './taint-provenance-graph';

interface RecordedNode {
	readonly vertex: DataflowGraphVertexArgument
	readonly value?: AnyAbstractDomain
	readonly call?:  TaintCallResolution
}

/**
 * The context of the abstract interpretation a {@link TaintProvenanceTracker} resolves the inputs of a call with.
 */
export type ProvenanceContext = AbsintContext<StateDomain<AnyAbstractDomain>>;

export interface TaintProvenanceTracker {
	/**
	 * Records a call whose taint was just resolved.
	 * @param call     - The call the taint was resolved for
	 * @param resolved - The resolved taint of the call
	 * @param ctx      - The context of the abstract interpretation at the call
	 */
	record(call: DataflowGraphVertexFunctionCall, resolved: ResolvedTaint, ctx: ProvenanceContext): void
	/**
	 * Records an assignment of a value to a variable.
	 * @param target - The id of the assigned variable
	 * @param source - The id of the assigned value
	 * @param ctx    - The context of the abstract interpretation at the assignment
	 */
	recordAssignment(target: NodeId, source: NodeId, ctx: ProvenanceContext): void
	/**
	 * Builds the provenance graph once the abstract interpretation has finished.
	 * @param valueOf - The taint of a node at the end of the analysis
	 * @param idMap   - The id map of the analysed program
	 */
	graph(valueOf: (id: NodeId) => AnyAbstractDomain | undefined, idMap?: AstIdMap): TaintProvenanceGraph
}

/**
 * The default {@link TaintProvenanceTracker}. Besides the calls whose taints the analysis resolves, it records the
 * inputs of these calls and the variables they read, so the graph shows where each value stems from.
 */
export class CallProvenanceTracker implements TaintProvenanceTracker {
	private readonly nodes = new Map<NodeId, RecordedNode>();
	private readonly edges = new DefaultMap<NodeId, Map<NodeId, EdgeType>>(() => new Map());
	private readonly definitions = new Map<NodeId, Set<NodeId>>();
	private top: AnyAbstractDomain | undefined;

	public record(call: DataflowGraphVertexFunctionCall, { value, role, category, record, suppressDefault }: ResolvedTaint, ctx: ProvenanceContext): void {
		this.top ??= value.top();
		const recorded = suppressDefault === undefined ? record : suppressDefault(record) ?? { ...record, passthrough: true };
		this.nodes.set(call.id, { vertex: call, value, call: { role, category, notes: recorded.notes, passthrough: recorded.passthrough } });
		const inputs = uniqueArray(recorded.inputs.flatMap(id => this.inputsOf(id, ctx))).filter(id => id !== call.id);
		const direct = new Set(call.args.flatMap(arg => {
			if(FunctionArgument.isEmpty(arg)) {
				return [];
			}
			const node = ctx.getAstNode(arg.nodeId);
			return RArgument.isWithValue(node) ? [arg.nodeId, node.value.info.id] : [arg.nodeId];
		}));
		for(const input of inputs) {
			this.link(call.id, input, direct.has(input) ? EdgeType.Argument : EdgeType.Reads);
		}
	}

	public recordAssignment(target: NodeId, source: NodeId, ctx: ProvenanceContext): void {
		const sources = this.resolve(source, ctx, false);
		this.definitions.set(target, new Set(sources));
		const vertex = ctx.getDfgVertex(target);
		const taint = ctx.getAbstractValue(source);
		if(sources.length > 0 && vertex !== undefined && taint !== undefined) {
			this.nodes.set(target, { vertex, value: taint });
			for(const origin of sources) {
				this.link(target, origin, EdgeType.Reads);
			}
		}
	}

	public graph(valueOf: (id: NodeId) => AnyAbstractDomain | undefined, idMap?: AstIdMap): TaintProvenanceGraph {
		const graph: TaintProvenanceGraph = new DataflowGraph(idMap);
		for(const [id, { vertex, value, call }] of this.nodes) {
			const taint = valueOf(id) ?? value ?? this.top;
			if(taint === undefined) {
				continue;
			}
			const node = idMap?.get(id);
			graph.addVertex({ ...vertex, taint: { code: RNode.lexeme(node), loc: SourceLocation.fromNode(node), value: taint, call } }, undefined as unknown as REnvironmentInformation, true);
		}
		for(const [from, targets] of this.edges.entries()) {
			for(const [to, type] of targets) {
				if(graph.hasVertex(from) && graph.hasVertex(to)) {
					graph.addEdge(from, to, type);
				}
			}
		}
		return graph;
	}

	private link(from: NodeId, to: NodeId, type: EdgeType): void {
		const targets = this.edges.get(from);
		targets.set(to, (targets.get(to) ?? 0) | type);
	}

	private resolve(id: NodeId, ctx: ProvenanceContext, variables: boolean): NodeId[] {
		if(this.nodes.get(id)?.call !== undefined) {
			return [id];
		}
		const definition = this.definitions.get(id);
		if(definition !== undefined) {
			return variables ? [id] : [...definition];
		}
		if(!RSymbol.is(ctx.getAstNode(id))) {
			return [];
		}
		const definitions = ctx.getVariableOrigins(id);
		return variables ? [...definitions] : definitions.flatMap(origin => [...this.definitions.get(origin) ?? []]);
	}

	private inputsOf(arg: NodeId, ctx: ProvenanceContext): NodeId[] {
		const resolved = this.resolve(arg, ctx, true);
		const inputs = resolved.length > 0 ? resolved : [arg];
		return inputs.flatMap(input => this.nodes.get(input)?.call !== undefined ? [input] : this.addInput(input, ctx));
	}

	private addInput(id: NodeId, ctx: ProvenanceContext): NodeId[] {
		const vertex = ctx.getDfgVertex(id);
		if(vertex === undefined) {
			return [];
		}
		this.nodes.set(id, { vertex, value: ctx.getAbstractValue(id) });
		for(const source of this.definitions.get(id) ?? []) {
			this.link(id, source, EdgeType.Reads);
		}
		return [id];
	}
}
