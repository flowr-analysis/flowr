import { DataflowGraph, UnknownSideEffect, type CallQualifier } from './graph';
import { AmbientAccess } from './ambient-access';
import { DfEdge, EdgeType } from './edge';
import { emptyGraph } from './dataflowgraph-builder';
import { getOriginInDfg, type Origin } from '../origin/dfg-get-origin';
import { GraphHelper } from './graph-helper';
import { ambientAccessOf, ambientAccessOfFunctions, computeCallGraphSummaries, foldCallGraph, propagateTransitiveSideEffects } from '../internal/process/functions/call/built-in/transitive-side-effects';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfgVertex, VertexType, type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo } from './vertex';
import { type BrandedIdentifier, type BrandedNamespace, Identifier } from '../environments/identifier';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { AttachedBasePackageSet, baseRExportOwner, isBaseRPackage } from '../../util/r-base-packages';
import { getCallables, importOrigin } from '../../project/plugins/file-plugins/files/flowr-namespace-file';
import { DefaultMap } from '../../util/collections/defaultmap';
import { getAllFunctionCallTargets, type LinkedFunctionResolver } from '../internal/linker';
import { getAllRefsToSymbol } from '../origin/dfg-get-symbol-refs';
import type { FlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { attachLibrary, type AttachSpec } from '../internal/process/functions/call/built-in/built-in-library';
import { type Environment, EnvType, REnvironment, type REnvironmentInformation } from '../environments/environment';
import { DepType } from '../../project/sigdb/schema';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { metaPackageCore } from '../../project/attached-packages';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';

/**
 * This is the root helper object to work with the {@link DataflowGraph}.
 * @helper dataflow This is the root helper object to work with the DataflowGraph.
 */
export const Dataflow = {
	...GraphHelper,
	name:   'Dataflow',
	/** Dispatches to helper functions to create new dataflow graphs, e.g. from a pipeline or an empty graph. */
	create: {
		/** Creates an empty dataflow graph with the given id map (or a new one if not provided). */
		empty: emptyGraph
	},
	/** Returns the origin of a vertex in the dataflow graph */
	origin: getOriginInDfg,
	/** The qualified identifier of the call with the given id, or `undefined` if it does not resolve to a package export and is not itself already namespaced (with `purrr` loaded, a `map()` call yields `Identifier.make('map', 'purrr')`; an explicit `pkg::fn()` call yields `pkg::fn` unchanged). */
	qualify(this: void, id: NodeId, graph: DataflowGraph, qualifyBaseR = true): Identifier | undefined {
		return graph.qualify(id, qualifyBaseR, resolveQualification);
	},
	/** The qualified name of every call of the graph, `undefined` for the calls that do not qualify. */
	qualifyAll(this: void, graph: DataflowGraph, qualifyBaseR = true): ReadonlyMap<NodeId, Identifier | undefined> {
		return graph.qualifyAll(qualifyBaseR, resolveQualification);
	},
	/** The packages the given nodes call into, as {@link Dataflow.qualify} resolves every call among them. */
	packagesOf(this: void, nodes: Iterable<NodeId>, graph: DataflowGraph, includeBaseR = false): Set<BrandedNamespace> {
		const packages = new Set<BrandedNamespace>();
		for(const id of nodes) {
			if(!DfgVertex.isFunctionCall(graph.getVertex(id))) {
				continue;
			}
			const qualified = Dataflow.qualify(id, graph, includeBaseR);
			const pkg = qualified === undefined ? undefined : Identifier.getNamespace(qualified);
			if(pkg !== undefined && (includeBaseR || !isBaseRPackage(pkg))) {
				packages.add(pkg);
			}
		}
		return packages;
	},
	/** Whether the call's result is passed on -- assigned, handed to another call, returned -- rather than left for R to auto-print. */
	valueIsUsed(this: void, id: NodeId, graph: DataflowGraph): boolean {
		const consuming = EdgeType.Argument | EdgeType.Returns | EdgeType.DefinedBy;
		for(const [, edge] of graph.edgesTo(id)) {
			if(DfEdge.includesType(edge, consuming)) {
				return true;
			}
		}
		return false;
	},
	/** Whether any argument of the call carries a value the program worked out, rather than only literals the author typed: `cat("starting\n")` is a log line, `cat("n =", length(m))` is a finding. */
	hasComputedArguments(this: void, id: NodeId, graph: DataflowGraph): boolean {
		for(const [target] of graph.edgesFrom(id)) {
			if(!NodeId.isBuiltIn(target) && !DfgVertex.isValue(graph.getVertex(target))) {
				return true;
			}
		}
		return false;
	},
	/** The ids at the far end of the outgoing edges of `node` that carry any of `types` (empty if there are none). */
	targetsOf(this: void, graph: DataflowGraph, node: NodeId, types: EdgeType): NodeId[] {
		const found: NodeId[] = [];
		for(const [target, edge] of graph.edgesFrom(node)) {
			if(DfEdge.includesType(edge, types)) {
				found.push(target);
			}
		}
		return found;
	},
	/** The ids at the near end of the incoming edges of `node` that carry any of `types` (empty if there are none). */
	sourcesOf(this: void, graph: DataflowGraph, node: NodeId, types: EdgeType): NodeId[] {
		const found: NodeId[] = [];
		for(const [source, edge] of graph.edgesTo(node)) {
			if(DfEdge.includesType(edge, types)) {
				found.push(source);
			}
		}
		return found;
	},
	/** Whether there is an edge from `from` to `to` that carries any of `types`. */
	hasEdge(this: void, graph: DataflowGraph, from: NodeId, to: NodeId, types: EdgeType): boolean {
		const edge = graph.edgesFrom(from).get(to);
		return edge !== undefined && DfEdge.includesType(edge, types);
	},
	/** The ids of the function definitions a call is linked to by a {@link EdgeType.Calls} edge (empty if none, e.g. for built-ins). */
	calleeIdsOf(this: void, graph: DataflowGraph, call: NodeId): NodeId[] {
		return Dataflow.targetsOf(graph, call, EdgeType.Calls).filter(t => DfgVertex.isFunctionDefinition(graph.getVertex(t)));
	},
	/** All known targets of a call, as well as the name sources which define them (empty if there are none). */
	callTargetsOf(this: void, call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation, resolver?: LinkedFunctionResolver): NodeId[] {
		return getAllFunctionCallTargets(call, graph, environment, resolver);
	},
	/** Whether every function the call may run is a built-in or one the program defines, so that what flowR knows about those functions is all there is to know about the call. */
	callsOnlyKnownFunctions(this: void, call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation): boolean {
		return Dataflow.callTargetsOf(call, graph, environment).every(t => NodeId.isBuiltIn(t) || DfgVertex.isFunctionDefinition(graph.getVertex(t)));
	},
	/** The calls within the body of a function definition, id and vertex paired. */
	* callsIn(this: void, definition: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph): Generator<[NodeId, DataflowGraphVertexFunctionCall]> {
		for(const node of definition.subflow.graph) {
			const vertex = graph.getVertex(node);
			if(DfgVertex.isFunctionCall(vertex)) {
				yield [node, vertex];
			}
		}
	},
	/** The value a plain assignment binds to the definition `def`, `undefined` for any other kind of definition (`class(x) <- `, `assign`, a parameter, ...). */
	assignedValueOf(this: void, def: NodeId, graph: DataflowGraph): NodeId | undefined {
		const vertex = graph.getVertex(def);
		const byAssignment = Dataflow.targetsOf(graph, def, EdgeType.DefinedBy).some(t => DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.Assignment));
		return DfgVertex.isVariableDefinition(vertex) && byAssignment && vertex.source?.length === 1 ? vertex.source[0] : undefined;
	},
	/** The vertices the value at `id` originates from: an argument is followed to its value, a read to the definitions it reads, a definition to what it is defined by (other than the assignment making it) or, for a replacement (`e$f <- v`), to what the variable held before, and with `throughAccess` an access to what it accesses. */
	valueSources(this: void, id: NodeId, graph: DataflowGraph, opts?: { readonly throughAccess?: boolean, readonly budget?: number }): NodeId[] | undefined {
		const budget = opts?.budget ?? 256;
		const origins: NodeId[] = [];
		const seen = new Set<NodeId>();
		const todo = [id];
		for(let at = todo.pop(); at !== undefined; at = todo.pop()) {
			if(seen.has(at)) {
				continue;
			} else if(seen.size >= budget) {
				return undefined;
			}
			seen.add(at);
			const node = graph.idMap?.get(at);
			const vertex = graph.getVertex(at);
			let next: readonly NodeId[] = [];
			if(RArgument.is(node)) {
				next = node.value === undefined ? [] : [node.value.info.id];
			} else if(DfgVertex.isUse(vertex)) {
				next = Dataflow.targetsOf(graph, at, EdgeType.Reads);
			} else if(DfgVertex.isVariableDefinition(vertex) && node?.info.role === RoleInParent.Accessed) {
				/* a replacement (`e$f <- v`) rebinds `e` to what it held, changed in part */
				next = Dataflow.targetsOf(graph, at, EdgeType.Reads).filter(t => DfgVertex.isVariableDefinition(graph.getVertex(t)));
			} else if(DfgVertex.isVariableDefinition(vertex)) {
				next = Dataflow.targetsOf(graph, at, EdgeType.DefinedBy).filter(t => !DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.Assignment));
			} else if(opts?.throughAccess && DfgVertex.hasOrigin(vertex, BuiltInProcName.Access) && DfgVertex.isFunctionCall(vertex)) {
				const [accessed] = vertex.args;
				next = accessed === undefined || accessed === EmptyArgument ? [] : [accessed.nodeId];
			}
			if(next.length === 0) {
				origins.push(at);
			} else {
				todo.push(...next);
			}
		}
		return origins;
	},
	/** Whether the call at `id` binds with `<<-` (or `->>`), be it the assignment itself or a replacement it runs: `x$a <<- v` rebinds `x` in an enclosing frame just like `x <<- v` does. */
	superAssigns(this: void, graph: DataflowGraph, id: NodeId): boolean {
		const vertex = graph.getVertex(id);
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.SuperAssignment)) {
			return true;
		} else if(!DfgVertex.hasOrigin(vertex, BuiltInProcName.Replacement) || graph.idMap === undefined) {
			return false;
		}
		const assignment = RNode.findEnclosing(id, graph.idMap, RBinaryOp.is);
		const operator = assignment === undefined ? undefined : (graph.idMap.get(assignment) as RBinaryOp | undefined)?.operator;
		return operator === '<<-' || operator === '->>';
	},
	/** Whether the definition `def` is made by a super assignment (`v <<- 5`, `v$a <<- 5`), see {@link Dataflow.superAssigns}. */
	definedBySuperAssignment(this: void, graph: DataflowGraph, def: NodeId): boolean {
		return Dataflow.targetsOf(graph, def, EdgeType.DefinedBy).some(t => Dataflow.superAssigns(graph, t));
	},

	/** Every variable definition of the graph by its unquoted name, in a single pass. */
	definitionsByName(this: void, graph: DataflowGraph): DefaultMap<BrandedIdentifier, NodeId[]> {
		const byName = new DefaultMap<BrandedIdentifier, NodeId[]>(() => []);
		for(const [id] of graph.verticesOfType(VertexType.VariableDefinition)) {
			const name = NodeId.recoverBareName(id, graph.idMap);
			if(name !== undefined) {
				byName.get(name).push(id);
			}
		}
		return byName;
	},
	/** The definitions and references to the symbol with the given id (including itself), or `undefined` if it is no symbol of the graph. */
	refsToSymbol(this: void, graph: DataflowGraph, id: NodeId): NodeId[] | undefined {
		return getAllRefsToSymbol(graph, id);
	},
	/** Interprocedural propagation of escaped side effects (attached packages, `<<-` definitions) to their callers. */
	sideEffects: {
		propagateTransitive:      propagateTransitiveSideEffects,
		callGraphSummaries:       computeCallGraphSummaries,
		foldCallGraph:            foldCallGraph,
		/** What running the given code reads and writes of the global state (pseudo variables like `#option:digits`, see {@link AmbientStateName}), the global variables the functions it calls bind, and its drawing calls (`SemanticCallTag.Graphics`), including what the functions it calls access. */
		ambientAccess:            ambientAccessOf,
		/** {@link Dataflow.sideEffects.ambientAccess} for every function definition when it is called, including what the functions it calls access. */
		ambientAccessOfFunctions: ambientAccessOfFunctions,
	},
	/** Only returns the sub-part of the graph that is determined by the given selection. */
	reduceGraph<G extends DataflowGraph>(this: void, graph: G, select: ReadonlySet<NodeId>, includeMissingTargets = false): G {
		const df = new DataflowGraph(graph.idMap);
		const roots = graph.rootIds();
		// if the graph has no root ids all selected vertices are non-root in this case we just break the fdef selection and promote all to root!
		const selectedRoots = roots.intersection(select);
		const forceRoot = selectedRoots.size === 0;
		for(const [id, vtx] of graph.vertices(true)) {
			if(select.has(id)) {
				df.addVertex(
					vtx,
					vtx.environment,
					forceRoot || roots.has(id)
				);
			}
		}

		for(const [from, targets] of graph.edges()) {
			if(!select.has(from)) {
				continue;
			}
			for(const [tar, { types }] of targets.entries()) {
				if(!includeMissingTargets && !select.has(tar)) {
					continue;
				}
				df.addEdge(from, tar, types);
			}
		}
		for(const u of graph.unknownSideEffects) {
			const id = UnknownSideEffect.id(u);
			if(select.has(id)) {
				df.markIdForUnknownSideEffects(id, UnknownSideEffect.linkTo(u));
			}
		}
		for(const id of graph.ambientAccessIds()) {
			if(select.has(id)) {
				df.recordAmbientAccess(id, AmbientAccess.names(graph.ambientAccessOf(id) as AmbientAccess));
			}
		}
		return df as G;
	},

	/** Equivalent to {@link Dataflow.reduceGraph|`reduceGraph`} followed by {@link Dataflow.invertGraph|`invertGraph`} but in a single pass over the graph, allocating only one intermediate object instead of two. */
	reduceAndInvertGraph<G extends DataflowGraph>(this: void, graph: G, select: ReadonlySet<NodeId>, cleanEnv: REnvironmentInformation): G {
		const df = new DataflowGraph(graph.idMap);
		for(const [id, vtx] of graph.vertices(true)) {
			if(select.has(id)) {
				df.addVertex(vtx, cleanEnv);
			}
		}
		for(const [from, targets] of graph.edges()) {
			if(!select.has(from)) {
				continue;
			}
			for(const [to, { types }] of targets) {
				if(!select.has(to)) {
					continue;
				}
				df.addEdge(to, from, types);
			}
		}
		for(const u of graph.unknownSideEffects) {
			const id = UnknownSideEffect.id(u);
			if(select.has(id)) {
				df.markIdForUnknownSideEffects(id, UnknownSideEffect.linkTo(u));
			}
		}
		for(const id of graph.ambientAccessIds()) {
			if(select.has(id)) {
				df.recordAmbientAccess(id, AmbientAccess.names(graph.ambientAccessOf(id) as AmbientAccess));
			}
		}
		return df as G;
	},

	/** See {@link DataflowGraph#isQuoted}, which this answers for `graph`. */
	isQuoted(this: void, id: NodeId, graph: DataflowGraph, withOutgoing = false): boolean {
		return graph.isQuoted(id, withOutgoing);
	},

	/** Given the id of a vertex (usually a variable use), this returns a reachable provenance set by calculating a non-interprocedural and non-context sensitive backward slice, but stopping at the given ids! */
	provenance(this: void, id: NodeId, graph: DataflowGraph, consider?: ReadonlySet<NodeId>, followEdges: number | undefined = EdgeType.Calls | EdgeType.Reads | EdgeType.Returns | EdgeType.Argument | EdgeType.DefinedBy | EdgeType.DefinedByOnCall): Set<NodeId> {
		return Dataflow.reachable(graph, id, { follow: followEdges, consider, cds: true });
	},
	/** A simple visitor akin to {@link RNode.visitAst} to traverse the dataflow graph starting from the start id and only respecting edge direction. */
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- visitors that only observe return nothing, and we never stop for them
	visitDfg(this: void, graph: DataflowGraph, start: NodeId, onVertex: (vtx: DataflowGraphVertexInfo) => (boolean | void)) {
		const queue = [start];
		const visited = new Set<NodeId>();

		while(queue.length > 0) {
			const nodeId = queue.pop();
			if(nodeId === undefined || visited.has(nodeId)) {
				continue;
			}
			visited.add(nodeId);
			const vtx = graph.get(nodeId);
			if(vtx === undefined) {
				continue;
			}
			const shouldStop = onVertex(vtx[0]);
			if(shouldStop) {
				continue;
			}
			for(const [to] of vtx[1]) {
				queue.push(to);
			}
		}
	},
	/** A convenience wrapper for {@link Dataflow.reduceGraph|reducing} the {@link Dataflow.provenance|provenance} of a graph. */
	provenanceGraph(this: void, id: NodeId, graph: DataflowGraph, consider?: ReadonlySet<NodeId>): DataflowGraph {
		return Dataflow.reduceGraph(graph, Dataflow.provenance(id, graph, consider));
	},
	/** What `library(pkg)` does, asked without analyzing any code. */
	library: {
		name:      'library',
		/** The `search()` entries `library(pkg)` adds; see {@link libraryAttachesOf}. */
		attaches:  libraryAttachesOf,
		/** The namespaces `library(pkg)` loads; see {@link libraryLoadsOf}. */
		loads:     libraryLoadsOf,
		/** The environment layers `library(pkg)` adds to the search path; see {@link libraryLayersOf}. */
		layers:    libraryLayersOf,
		/** The exports of `pkg` that re-export another package's function, with that package; see {@link libraryReexportsOf}. */
		reexports: libraryReexportsOf
	}
} as const;

/** both qualifications of a call from a single origin resolution, as the base-R step only adds to what the origins gave */
const resolveQualification: CallQualifier = (graph, id, vertex) => {
	const origins = Dataflow.origin(graph, id);
	const name = DfgVertex.isFunctionCall(vertex) ? vertex.name : undefined;
	const bare = Identifier.toQualified(origins, name, false);
	return [bare, bare ?? Identifier.toQualified(origins, name, true) ?? aliasedBaseR(graph, id, origins)];
};

/** The base-R function an aliased call resolves to when it reaches nothing of the analyzed code, `utils::read.csv` for the `f()` of `f <- read.csv`, which the origins alone cannot tell from a call of the code, as both read the definition of `f`. */
function aliasedBaseR(graph: DataflowGraph, id: NodeId, origins: readonly Origin[] | undefined): Identifier | undefined {
	if(!origins?.some(o => !('proc' in o) && !NodeId.isBuiltIn(o.id))) {
		return undefined;
	}
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(DfEdge.includesType(edge, EdgeType.Calls) && !NodeId.isBuiltIn(target)) {
			return undefined;
		}
	}
	const names = new Set(origins.flatMap(o => 'proc' in o && NodeId.isBuiltIn(o.proc) ? [NodeId.fromBuiltIn(o.proc)] : []));
	const [name] = names;
	const owner = names.size === 1 ? baseRExportOwner(name) : undefined;
	return owner === undefined ? undefined : Identifier.make(name, owner);
}

/** The layers `library(pkg)` puts on an empty search path, innermost first, built by the {@link attachLibrary} the analysis uses: per attached package its namespace (exports) and imports layer, or for an unresolved one what flowR states about it or a bare {@link EnvType.LoadedNamespace}. */
function libraryLayersOf(this: void, ctx: FlowrAnalyzerContext, pkg: BrandedNamespace, spec?: AttachSpec): readonly Environment[] {
	return [...REnvironment.searchPath(attachLibrary(pkg, ctx.deps.getDependency(pkg), ctx.env.makeCleanEnv(), ctx, spec).current)];
}

/** The `search()` entries `library(pkg)` adds, in `search()` order: `pkg`, its `Depends` and a meta-package's core set, recursively. */
function libraryAttachesOf(this: void, ctx: FlowrAnalyzerContext, pkg: BrandedNamespace, spec?: AttachSpec): readonly BrandedNamespace[] {
	if(spec?.namespaceOnly) {
		return []; // loading a namespace puts nothing on the search path
	}
	/* a package R attaches on startup is on the search path already, so a `Depends: methods` adds no entry */
	return libraryLayersOf(ctx, pkg, spec).filter(l => l.t !== EnvType.Imports && l.n !== undefined && !AttachedBasePackageSet.has(l.n)).map(l => l.n as string);
}

/** The exports of `pkg` it re-exports from another package, mapped to that package (`%>%` of dplyr to `magrittr`). */
function libraryReexportsOf(this: void, ctx: FlowrAnalyzerContext, pkg: BrandedNamespace): ReadonlyMap<BrandedIdentifier, BrandedNamespace> {
	const ns = ctx.deps.getDependency(pkg)?.namespaceInfo;
	const reexports = new Map<BrandedIdentifier, BrandedNamespace>();
	if(ns === undefined) {
		return reexports;
	}
	for(const fn of getCallables(ns)) {
		const origin = importOrigin(fn, ns);
		if(origin !== undefined) {
			reexports.set(fn, origin);
		}
	}
	return reexports;
}

/** The packages loading `pkg` loads directly: its `Depends` and `Imports`, its `NAMESPACE` imports, and a meta-package's core set. */
function directLoadsOf(ctx: FlowrAnalyzerContext, pkg: BrandedNamespace): BrandedNamespace[] {
	const db = ctx.deps.signatures();
	const dependency = ctx.deps.getDependency(pkg);
	return [
		...(db.sources().dependencies(pkg, db.versionOf(pkg)) ?? [])
			.filter(d => (d.type === DepType.Depends || d.type === DepType.Imports) && d.name !== 'R').map(d => d.name),
		...dependency?.namespaceInfo?.importedPackages.keys() ?? [],
		...dependency?.dependencies?.map(d => d.name) ?? [],
		...metaPackageCore(pkg, db.versionOf(pkg))
	];
}

/** The namespaces `library(pkg)` loads, `pkg` first: the closure over {@link directLoadsOf} at the versions the analysis assumes. */
function libraryLoadsOf(this: void, ctx: FlowrAnalyzerContext, pkg: BrandedNamespace): readonly BrandedNamespace[] {
	const loaded = new Set([pkg]);
	for(const p of loaded) {
		for(const d of directLoadsOf(ctx, p)) {
			loaded.add(d);
		}
	}
	return [...loaded];
}
