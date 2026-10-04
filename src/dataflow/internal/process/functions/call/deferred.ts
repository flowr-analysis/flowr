import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../../../environments/identifier';
import { removeRQuotes } from '../../../../../r-bridge/retriever';
import { EdgeType, DfEdge } from '../../../../graph/edge';
import type { DataflowGraph } from '../../../../graph/graph';
import { DfgVertex, VertexType } from '../../../../graph/vertex';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { reachableFrom, reachableTo, someAlwaysBefore } from '../../../../../control-flow/happens-before';
import { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

/** The reads that may force the expression, and the control flow deciding what they can see. */
export interface ForceSites {
	readonly cfg:     ControlFlowGraph
	readonly sites:   readonly NodeId[]
	/** the name the deferred expression is bound to, whose binding its own writes replace */
	readonly binding: NodeId
	/** what reaches the sites and what they reach, filled on first use and shared by everyone handed these sites */
	readonly reach?:  { before?: ReadonlySet<NodeId>, after?: ReadonlySet<NodeId>, always?: Map<NodeId, boolean> }
}

/** Drops the read of `target` from `use`, for a binding another write has replaced. */
function dropRead(graph: DataflowGraph, use: NodeId, target: NodeId): void {
	graph.removeEdgeType(use, target, EdgeType.Reads);
}

/** Where a name is bound and where it is read, so that a deferred expression can reach either. */
export
interface NameIndex {
	readonly definitions: ReadonlyMap<string, NodeId[]>
	readonly uses:        ReadonlyMap<string, NodeId[]>
}

function add(index: Map<string, NodeId[]>, name: string, id: NodeId): void {
	const known = index.get(name);
	if(known) {
		known.push(id);
	} else {
		index.set(name, [id]);
	}
}

/** The names a deferred expression touches, each with the node touching it and whether it is written. */
function namesWithin<Info>(expr: NodeId, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): readonly (readonly [NodeId, string, boolean])[] {
	const node = idMap.get(expr);
	const names: (readonly [NodeId, string, boolean])[] = [];
	if(node === undefined) {
		return names;
	}
	const callees = new Set<NodeId>();
	RNode.visitAst<Info & ParentInformation>(node, inner => {
		if(RFunctionCall.isNamed(inner)) {
			callees.add(inner.functionName.info.id);
			/* a call reads the function it names, so `evalq(f())` needs the definition of `f` */
			if(DfgVertex.isFunctionCall(graph.getVertex(inner.info.id))) {
				names.push([inner.info.id, Identifier.getName(inner.functionName.content), false]);
			}
			return false;
		} else if(!RSymbol.is(inner) || callees.has(inner.info.id)) {
			return false;
		}
		const vertex = graph.getVertex(inner.info.id);
		if(DfgVertex.isUse(vertex) || DfgVertex.isVariableDefinition(vertex)) {
			names.push([inner.info.id, Identifier.getName(inner.content), DfgVertex.isVariableDefinition(vertex)]);
		}
		return false;
	});
	return names;
}

/**
 * An expression R evaluates at a time we cannot pin down: the body a `delayedAssign` binds, forced at some
 * later read of the name, or a promise a closure carries past the call that created it.
 *
 * Since the moment is open, every binding the expression may meet is a candidate, and symmetrically so:
 * a name it reads may read any definition of that name, and a name it writes may be read by any use of it.
 * That is the may-analysis both directions ask for, so nothing the expression really depends on, and nothing
 * really depending on it, can be missed.
 */
export const Deferred = {
	/** Where each name is bound and read, built once and shared by every deferred expression in the graph. */
	indexOf<Info>(this: void, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): NameIndex {
		const definitions = new Map<string, NodeId[]>();
		const uses = new Map<string, NodeId[]>();
		for(const [type, index] of [[VertexType.VariableDefinition, definitions], [VertexType.Use, uses]] as const) {
			for(const [id] of graph.verticesOfType(type)) {
				const name = NodeId.recoverName(id, idMap);
				if(name !== undefined) {
					add(index, removeRQuotes(name), id);
				}
			}
		}
		return { definitions, uses };
	},

	/**
	 * The reads that may be the one forcing `binding`: every read of it that no other read always precedes,
	 * since an earlier read would already have forced it and cached the value.
	 */
	forcedAt(this: void, graph: DataflowGraph, binding: NodeId, cfg: ControlFlowGraph): readonly NodeId[] {
		const reads: NodeId[] = [];
		for(const [reader, edge] of graph.edgesTo(binding)) {
			if(DfEdge.includesType(edge, EdgeType.Reads)) {
				reads.push(reader);
			}
		}
		if(reads.length < 2) {
			return reads;
		}
		const readSet = new Set(reads);
		return reads.filter(r => !someAlwaysBefore(cfg, readSet, r));
	},

	/**
	 * Links the writes an expression performs to the uses that may observe them, for a call evaluating the
	 * expression at a point control flow can pin down (`eval`). The reads are settled by the evaluating call
	 * itself, against the environment in effect there, so only this direction is left open.
	 */
	publish<Info>(this: void, graph: DataflowGraph, expr: NodeId, index: NameIndex, idMap: AstIdMap<Info & ParentInformation>, at: NodeId, cfg?: ControlFlowGraph): void {
		const within = namesWithin(expr, graph, idMap);
		const own = new Set(within.map(([id]) => id));
		let reachedFromAt: ReadonlySet<NodeId> | undefined;
		for(const [node, name, writes] of within) {
			if(!writes) {
				continue;
			}
			for(const use of index.uses.get(name) ?? []) {
				/* only a use the evaluation may reach can see what it wrote */
				if(cfg !== undefined) {
					reachedFromAt ??= reachableFrom(cfg, [at]);
				}
				if(own.has(use) || (reachedFromAt !== undefined && !reachedFromAt.has(use))) {
					continue;
				}
				graph.addEdge(use, node, EdgeType.Reads);
			}
		}
	},

	/**
	 * Links the expression rooted at `expr` to the bindings it may meet when it is evaluated. Given the reads
	 * that may force it, control flow rules out what no force can reach; without them every binding stays a
	 * candidate.
	 */
	link<Info>(this: void, graph: DataflowGraph, expr: NodeId, index: NameIndex, idMap: AstIdMap<Info & ParentInformation>, forces?: ForceSites): void {
		const within = namesWithin(expr, graph, idMap);
		const own = new Set(within.map(([id]) => id));
		/* one walk per direction answers every candidate, so the sets are built once and only when asked for */
		const reach = forces?.reach ?? {};
		/* a binding matters only if some force can see it, and a use only if some force can reach it */
		const seenByAForce = (definition: NodeId) => forces === undefined
			|| (reach.before ??= reachableTo(forces.cfg, forces.sites)).has(definition);
		/* the forcing read yields the promise's value, so only reads after it observe what the promise wrote */
		const reachedByAForce = (use: NodeId) => forces === undefined
			|| (!forces.sites.includes(use) && (reach.after ??= reachableFrom(forces.cfg, forces.sites)).has(use));
		/* whether some force always happens before `use`, asked again by every write of the bound name */
		let sites: ReadonlySet<NodeId> | undefined;
		const alwaysAfterAForce = (use: NodeId): boolean => {
			const known = (reach.always ??= new Map<NodeId, boolean>()).get(use);
			if(known !== undefined || forces === undefined) {
				return known ?? false;
			}
			/* one walk back from the use answers it for all sites, a use is never a site itself (see `reachedByAForce`) */
			const always = someAlwaysBefore(forces.cfg, sites ??= new Set(forces.sites), use);
			reach.always.set(use, always);
			return always;
		};
		/* `delayedAssign` names its variable with a string literal, so the recovered name still carries quotes */
		const bindingName = forces === undefined ? undefined : removeRQuotes(NodeId.recoverName(forces.binding, idMap) ?? '');
		for(const [node, name, writes] of within) {
			if(writes) {
				/* a write of the bound name replaces the binding, so a read it definitely reaches sees only it */
				const shadows = forces !== undefined && name === bindingName && graph.getVertex(node)?.cds === undefined;
				for(const use of index.uses.get(name) ?? []) {
					if(!own.has(use) && reachedByAForce(use)) {
						graph.addEdge(use, node, EdgeType.Reads);
						if(shadows && alwaysAfterAForce(use)) {
							dropRead(graph, use, forces.binding);
						}
					}
				}
			} else {
				for(const definition of index.definitions.get(name) ?? []) {
					if(seenByAForce(definition)) {
						graph.addEdge(node, definition, EdgeType.Reads);
					}
				}
			}
		}
	}
} as const;
