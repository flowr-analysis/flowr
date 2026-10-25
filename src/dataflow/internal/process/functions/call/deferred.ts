import { RString } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../../../environments/identifier';
import { EdgeType } from '../../../../graph/edge';
import type { DataflowGraph } from '../../../../graph/graph';
import { DfgVertex, VertexType } from '../../../../graph/vertex';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { firstOnSomePath, reachableFrom, reachableTo, someAlwaysBefore } from '../../../../../control-flow/happens-before';
import { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { linkCallToDefinitions } from '../../../linker';
import { RFunctionDefinition } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { Dataflow } from '../../../../graph/df-helper';
import { RoleInParent } from '../../../../../r-bridge/lang-4.x/ast/model/processing/role';

/** The reads that may force the expression, and the control flow deciding what they can see. */
export interface ForceSites {
	readonly cfg:     ControlFlowGraph
	readonly sites:   readonly NodeId[]
	/** the name the deferred expression is bound to, whose binding its own writes replace */
	readonly binding: NodeId
	/** what reaches the sites and what they reach, filled on first use and shared by everyone handed these sites */
	readonly reach?:  { before?: ReadonlySet<NodeId>, after?: ReadonlySet<NodeId>, always?: Map<NodeId, boolean> }
}

/** Where a name is bound and where it is read, so that a deferred expression can reach either. */
export
interface NameIndex {
	readonly definitions: ReadonlyMap<string, NodeId[]>
	readonly uses:        ReadonlyMap<string, NodeId[]>
}

/** The vertices of `type` by their unquoted name. */
export function verticesByName<Info>(graph: DataflowGraph, type: VertexType, idMap: AstIdMap<Info & ParentInformation>): Map<string, NodeId[]> {
	const named = graph.vertexIdsOfType(type).filter(id => NodeId.recoverName(id, idMap) !== undefined);
	return Map.groupBy(named, id => RString.unquote(NodeId.recoverName(id, idMap) as string));
}

/** The names a deferred expression touches, each with the node touching it and whether it is written. */
function namesWithin<Info>(expr: NodeId, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): readonly (readonly [NodeId, string, boolean])[] {
	const names: (readonly [NodeId, string, boolean])[] = [];
	const callees = new Set<NodeId>();
	RNode.visitAst<Info & ParentInformation>(idMap.get(expr), inner => {
		/* a definition only creates its closure, the body runs when it is called and that call carries its effects */
		if(RFunctionDefinition.is(inner)) {
			return true;
		} else if(RFunctionCall.isNamed(inner)) {
			callees.add(inner.functionName.info.id);
			/* a call reads the function it names, so `evalq(f())` needs the definition of `f` */
			if(DfgVertex.isFunctionCall(graph.getVertex(inner.info.id))) {
				names.push([inner.info.id, Identifier.getName(inner.functionName.content), false]);
				for(const def of Dataflow.sourcesOf(graph, inner.info.id, EdgeType.SideEffectOnCall)) {
					const name = NodeId.recoverName(def, idMap);
					if(name !== undefined) {
						names.push([def, RString.unquote(name), true]);
					}
				}
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
		return {
			definitions: verticesByName(graph, VertexType.VariableDefinition, idMap),
			uses:        verticesByName(graph, VertexType.Use, idMap)
		};
	},

	/**
	 * The reads that may be the one forcing `binding`: every read of it that no other read always precedes,
	 * since an earlier read would already have forced it and cached the value.
	 * With `viaClosures`, a closure reading a `delayedAssign` binding forces it when called.
	 */
	forcedAt(this: void, graph: DataflowGraph, binding: NodeId, cfg: ControlFlowGraph, viaClosures = false): readonly NodeId[] {
		const reads = Dataflow.sourcesOf(graph, binding, EdgeType.Reads);
		const readSet = new Set(reads);
		/* a closure reading it and the call of that closure may skip the read, so they never rule out a later force */
		const calls = viaClosures
			? Dataflow.sourcesOf(graph, binding, EdgeType.DefinesOnCall | EdgeType.DefinedByOnCall).filter(r => !readSet.has(r))
			: [];
		if(reads.length < 2) {
			return reads.concat(calls);
		}
		/* the reads of a parameter all sit in its function, which is where the walk can stay */
		const parameter = graph.idMap?.get(binding)?.info.parent;
		const owner = graph.getVertex(graph.idMap?.get(parameter ?? '')?.info.parent ?? '');
		const first = firstOnSomePath(cfg, readSet, DfgVertex.isFunctionDefinition(owner) && NodeId.normalize(binding) in owner.params ? owner.subflow.graph : undefined);
		return reads.filter(r => first.has(r)).concat(calls);
	},

	/**
	 * Links the writes an expression performs to the uses that may observe them, for a call evaluating the
	 * expression at a point control flow can pin down (`eval`). The reads are settled by the evaluating call
	 * itself, against the environment in effect there, so only this direction is left open.
	 */
	publish<Info>(this: void, graph: DataflowGraph, expr: NodeId, index: NameIndex, idMap: AstIdMap<Info & ParentInformation>, at: NodeId, sites: readonly NodeId[], cfg?: ControlFlowGraph): void {
		const within = namesWithin(expr, graph, idMap);
		const own = new Set(within.map(([id]) => id));
		let reachedFromAt: ReadonlySet<NodeId> | undefined;
		let reachedFromSites: ReadonlySet<NodeId> | undefined;
		for(const [node, name] of within.filter(([, , writes]) => writes)) {
			/* a write leaving the evaluating frame lands whenever a call of the closure evaluating it does */
			const escapes = DfgVertex.hasOrigin(graph.getVertex(idMap.get(node)?.info.parent ?? ''), BuiltInProcName.SuperAssignment);
			for(const site of escapes ? sites : []) {
				if(site !== at) {
					graph.addEdge(node, site, EdgeType.SideEffectOnCall);
				}
			}
			for(const use of index.uses.get(name) ?? []) {
				/* only a use the evaluation may reach can see what it wrote */
				const reached = cfg === undefined ? undefined : escapes ? reachedFromSites ??= reachableFrom(cfg, [at, ...sites]) : reachedFromAt ??= reachableFrom(cfg, [at]);
				if(!own.has(use) && (reached === undefined || reached.has(use))) {
					graph.addEdge(use, node, EdgeType.Reads);
				}
			}
		}
	},

	/**
	 * Links the expression rooted at `expr` to the bindings it may meet when it is evaluated. Given the reads
	 * that may force it, control flow rules out what no force can reach; without them every binding stays a
	 * candidate. An argument (`inCallerFrame`) is evaluated in the frame of its call, so the parameters and local
	 * bindings of the function forcing it are none it can meet, even though they come before the force.
	 */
	link<Info>(this: void, graph: DataflowGraph, expr: NodeId, index: NameIndex, idMap: AstIdMap<Info & ParentInformation>, forces?: ForceSites, inCallerFrame = false): void {
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
		const bindingName = forces === undefined ? undefined : RString.unquote(NodeId.recoverName(forces.binding, idMap) ?? '');
		for(const [node, name, writes] of within) {
			if(writes) {
				/* a write of the bound name replaces the binding, so a read it definitely reaches sees only it */
				const shadows = forces !== undefined && name === bindingName && graph.getVertex(node)?.cds === undefined;
				for(const use of index.uses.get(name) ?? []) {
					if(own.has(use) || !reachedByAForce(use)) {
						continue;
					}
					graph.addEdge(use, node, EdgeType.Reads);
					/* the write only happens because a force runs it */
					for(const site of forces?.sites ?? []) {
						graph.addEdge(node, site, EdgeType.Reads);
					}
					if(shadows && alwaysAfterAForce(use)) {
						graph.removeEdgeType(use, forces.binding, EdgeType.Reads);
					}
				}
			} else {
				const seen = (index.definitions.get(name) ?? []).filter(d => seenByAForce(d) && (!inCallerFrame || visibleFrom(expr, d, graph, idMap)));
				for(const definition of seen) {
					graph.addEdge(node, definition, EdgeType.Reads);
				}
				if(forces !== undefined) {
					/* a deferred call runs what its name holds at the force, which may be defined after the call was written */
					linkCallToDefinitions(graph, node, seen, idMap);
				}
			}
		}
	}
} as const;

/** Whether the binding `definition` lives in a frame `expr` sees: not a parameter or a local binding of a function `expr` is not within. */
function visibleFrom<Info>(expr: NodeId, definition: NodeId, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): boolean {
	const node = idMap.get(definition);
	const parent = node?.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	const local = node?.info.role === RoleInParent.ParameterName || DfgVertex.hasOrigin(graph.getVertex(parent?.info.id ?? ''), BuiltInProcName.Assignment);
	const frame = local ? RNode.findEnclosing(definition, idMap, RFunctionDefinition.is) : undefined;
	return frame === undefined || RNode.findEnclosing(expr, idMap, n => n.info.id === frame) !== undefined;
}
