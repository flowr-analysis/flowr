import { getOrSet } from '../../../../../util/collections/defaultmap';
import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type BrandedIdentifier, type NodesByName, Identifier } from '../../../../environments/identifier';
import { EdgeType } from '../../../../graph/edge';
import type { DataflowGraph } from '../../../../graph/graph';
import { type DataflowGraphVertexFunctionDefinition, DfgVertex, VertexType } from '../../../../graph/vertex';
import type { ControlFlowGraph } from '../../../../../control-flow/control-flow-graph';
import { firstOnSomePath, reachableFrom, reachableTo, someAlwaysBefore } from '../../../../../control-flow/happens-before';
import { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { getAllLinkedFunctionDefinitions, linkCallToFunctions } from '../../../linker';
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
	readonly reach?:  {
		before?: ReadonlySet<NodeId>, after?: ReadonlySet<NodeId>, always?: Map<NodeId, boolean>, seen?: WeakMap<NodesByName, Map<BrandedIdentifier, readonly NodeId[]>>,
		/** the captures evaluated elsewhere that were linked with these sites already, the same for every call handing one on */
		linked?: Set<NodeId>
	}
}

/** Where a name is bound and where it is read, so that a deferred expression can reach either. */
export
interface NameIndex {
	readonly definitions: NodesByName
	readonly uses:        NodesByName
	/** the functions each binding may hold, filled on first use by every deferred call meeting it */
	readonly held?:       Map<NodeId, readonly Required<DataflowGraphVertexFunctionDefinition>[]>
}

/** The vertices of `type` by their unquoted name. */
export function verticesByName<Info>(graph: DataflowGraph, type: VertexType, idMap: AstIdMap<Info & ParentInformation>): Map<string, NodeId[]> {
	const named = graph.vertexIdsOfType(type).filter(id => NodeId.recoverName(id, idMap) !== undefined);
	return Map.groupBy(named, id => NodeId.recoverBareName(id, idMap) as string);
}

/** A call or a symbol of a deferred expression, in the order the expression holds them. */
interface Touched {
	readonly call: boolean
	readonly id:   NodeId
	readonly name: BrandedIdentifier
}

/** Per AST, what each deferred expression holds: the syntax does not change, so every link of the same expression shares one walk. */
const touchedCache = new WeakMap<AstIdMap, Map<NodeId, readonly Touched[]>>();

/** The calls and symbols below `expr`, not descending into function definitions, whose bodies run only when called. */
function touchedWithin<Info>(expr: NodeId, idMap: AstIdMap<Info & ParentInformation>): readonly Touched[] {
	return getOrSet(getOrSet(touchedCache, idMap, () => new Map<NodeId, readonly Touched[]>()), expr, () => {
		const touched: Touched[] = [];
		const callees = new Set<NodeId>();
		RNode.visitAst<Info & ParentInformation>(idMap.get(expr), inner => {
			/* a definition only creates its closure, the body runs when it is called and that call carries its effects */
			if(RFunctionDefinition.is(inner)) {
				return true;
			} else if(RFunctionCall.isNamed(inner)) {
				callees.add(inner.functionName.info.id);
				touched.push({ call: true, id: inner.info.id, name: Identifier.getName(inner.functionName.content) });
			} else if(RSymbol.is(inner) && !callees.has(inner.info.id)) {
				touched.push({ call: false, id: inner.info.id, name: Identifier.getName(inner.content) });
			}
			return false;
		});
		return touched;
	});
}

/** The names a deferred expression touches, each with the node touching it and whether it is written. */
function namesWithin<Info>(expr: NodeId, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): readonly (readonly [NodeId, BrandedIdentifier, boolean])[] {
	const names: (readonly [NodeId, BrandedIdentifier, boolean])[] = [];
	for(const { call, id, name } of touchedWithin(expr, idMap)) {
		const vertex = graph.getVertex(id);
		if(call) {
			/* a call reads the function it names, so `eval(quote(f()))` needs the definition of `f` */
			if(DfgVertex.isFunctionCall(vertex)) {
				names.push([id, name, false]);
				for(const def of Dataflow.sourcesOf(graph, id, EdgeType.SideEffectOnCall)) {
					const written = NodeId.recoverBareName(def, idMap);
					if(written !== undefined) {
						names.push([def, written, true]);
					}
				}
			}
		} else if(DfgVertex.isUse(vertex) || DfgVertex.isVariableDefinition(vertex)) {
			names.push([id, name, DfgVertex.isVariableDefinition(vertex)]);
		}
	}
	return names;
}

/** An expression R evaluates at a time we cannot pin down: the body a `delayedAssign` binds, forced at some later read of the name, or a promise a closure carries past the call that created it. */
export const Deferred = {
	/** Where each name is bound and read, built once and shared by every deferred expression in the graph. */
	indexOf<Info>(this: void, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): NameIndex {
		return {
			definitions: verticesByName(graph, VertexType.VariableDefinition, idMap),
			uses:        verticesByName(graph, VertexType.Use, idMap),
			held:        new Map()
		};
	},

	/** The reads that may be the one forcing `binding`: every read of it that no other read always precedes, since an earlier read would already have forced it and cached the value. */
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

	/** Links the writes an expression performs to the uses that may observe them, for a call evaluating the expression at a point control flow can pin down (`eval`). */
	publish<Info>(this: void, graph: DataflowGraph, expr: NodeId, index: NameIndex, idMap: AstIdMap<Info & ParentInformation>, at: NodeId, sites: readonly NodeId[], cfg?: ControlFlowGraph): void {
		const within = namesWithin(expr, graph, idMap);
		const own = new Set(within.map(([id]) => id));
		let reachedFromAt: ReadonlySet<NodeId> | undefined;
		let reachedFromSites: ReadonlySet<NodeId> | undefined;
		for(const [node, name] of within.filter(([, , writes]) => writes)) {
			/* a write leaving the evaluating frame lands whenever a call of the closure evaluating it does */
			const escapes = Dataflow.superAssigns(graph, idMap.get(node)?.info.parent ?? '');
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

	/** Links the expression rooted at `expr` to the bindings it may meet when it is evaluated. */
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
		/* the bindings of a name some force can see, asked again by every expression these forces evaluate (`eval` deep in a function meets thousands of bindings of `x`) */
		function seenByAForceNamed(name: BrandedIdentifier): readonly NodeId[] {
			const byName = getOrSet(reach.seen ??= new WeakMap(), index.definitions, () => new Map<BrandedIdentifier, readonly NodeId[]>());
			return getOrSet(byName, name, () => (index.definitions.get(name) ?? []).filter(seenByAForce));
		}
		/* whether some force always happens before `use`, asked again by every write of the bound name */
		let sites: ReadonlySet<NodeId> | undefined;
		function alwaysAfterAForce(use: NodeId): boolean {
			const known = (reach.always ??= new Map<NodeId, boolean>()).get(use);
			if(known !== undefined || forces === undefined) {
				return known ?? false;
			}
			/* one walk back from the use answers it for all sites, a use is never a site itself (see `reachedByAForce`) */
			const always = someAlwaysBefore(forces.cfg, sites ??= new Set(forces.sites), use);
			reach.always.set(use, always);
			return always;
		}
		/* the bindings of a name this expression sees, the same for every read of it here */
		const visible = new Map<BrandedIdentifier, readonly NodeId[]>();
		/* `delayedAssign` names its variable with a string literal */
		const bindingName = forces === undefined ? undefined : NodeId.recoverBareName(forces.binding, idMap) ?? '';
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
				const seen = inCallerFrame ? getOrSet(visible, name, () => (index.definitions.get(name) ?? []).filter(d => seenByAForce(d) && visibleFrom(expr, d, graph, idMap))) : seenByAForceNamed(name);
				for(const definition of seen) {
					graph.addEdge(node, definition, EdgeType.Reads);
				}
				if(forces !== undefined && seen.length > 0 && DfgVertex.isFunctionCall(graph.getVertex(node))) {
					/* a deferred call runs what its name holds at the force, which may be defined after the call was written; every call of the name holds the same */
					linkCallToFunctions(graph, node, functionsHeldBy(seen, graph, index.held), idMap);
				}
			}
		}
	}
} as const;

/** The functions any of the bindings may hold, each binding walked once per index: deferred calls of one name in many places meet the same bindings. */
function functionsHeldBy(bindings: readonly NodeId[], graph: DataflowGraph, held: NameIndex['held']): readonly Required<DataflowGraphVertexFunctionDefinition>[] {
	if(held === undefined) {
		return [...getAllLinkedFunctionDefinitions(new Set(bindings), graph)[0]];
	}
	const functions = new Set<Required<DataflowGraphVertexFunctionDefinition>>();
	for(const binding of bindings) {
		for(const f of getOrSet(held, binding, () => [...getAllLinkedFunctionDefinitions(new Set([binding]), graph)[0]])) {
			functions.add(f);
		}
	}
	return [...functions];
}

/** Whether the binding `definition` lives in a frame `expr` sees: not a parameter or a local binding of a function `expr` is not within. */
function visibleFrom<Info>(expr: NodeId, definition: NodeId, graph: DataflowGraph, idMap: AstIdMap<Info & ParentInformation>): boolean {
	const node = idMap.get(definition);
	const parent = node?.info.parent === undefined ? undefined : idMap.get(node.info.parent);
	const local = node?.info.role === RoleInParent.ParameterName || DfgVertex.hasOrigin(graph.getVertex(parent?.info.id ?? ''), BuiltInProcName.Assignment);
	const frame = local ? RNode.findEnclosing(definition, idMap, RFunctionDefinition.is) : undefined;
	return frame === undefined || RNode.findEnclosing(expr, idMap, n => n.info.id === frame) !== undefined;
}
