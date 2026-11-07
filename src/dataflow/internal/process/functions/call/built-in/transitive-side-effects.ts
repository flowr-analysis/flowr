import { type DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import type { DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { DfEdge, EdgeType } from '../../../../../graph/edge';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EnvType, type Environment, REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachExportVertex, attachLibrary } from './built-in-library';
import type { IdentifierDefinition, IdentifierReference, InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { Frame, type MemoryView } from '../../../../../environments/frame-memory';
import { DfgVertex, VertexType } from '../../../../../graph/vertex';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { ProgramOrder } from '../../../../program-order';
import { Resolve } from '../../../../../environments/resolve-helper';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { drawingWritesDevice, hiddenSideEffects, reachesBuiltInLate, readsOfHiddenBuiltIn, writesOfHiddenBuiltIn } from './built-in-ambient-state';
import { DefaultMap } from '../../../../../../util/collections/defaultmap';
import { Dataflow } from '../../../../../graph/df-helper';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import type { AmbientAccessRecord } from '../../../../../graph/ambient-access';
import { BuiltInIndex, callFnProps, queryFnProps } from '../../../../../environments/query-fn-props';
import type { BuiltInFnInfo } from '../../../../../environments/built-in-props';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { SemanticCallTag } from '../../../../../environments/built-in-props';
import { type DataflowInformation, type ControlDependency, happensInEveryBranch } from '../../../../../info';
import { ReachSummaries, unionOfSets } from '../../../../../../util/fixpoint';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

/**
 * Computes, for every function-definition vertex `F`, `summary(F) = own(F)` unioned with `summary(G)` over every transitive callee `G`.
 * @param    graph - the fully linked dataflow graph
 * @param    own   - the effects a single function definition produces itself (its contribution to the summary)
 * @returns        a map from each function-definition vertex to its transitive-effect summary
 * @useInstead {@link Dataflow.sideEffects.callGraphSummaries}
 */
export function computeCallGraphSummaries<T>(this: void, graph: DataflowGraph, own: (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => Iterable<T>): Map<NodeId, ReadonlySet<T>> {
	const summaries = new ReachSummaries<NodeId, ReadonlySet<T>>(id => {
		const vertex = graph.getVertex(id);
		if(!DfgVertex.isFunctionDefinition(vertex)) {
			return [];
		}
		/* an exit hook (`on.exit(expr)`) runs as part of the function */
		return Dataflow.callsIn(vertex, graph).flatMap(([node]) => Dataflow.calleeIdsOf(graph, node)).toArray().concat(vertex.subflow.hooks.map(h => h.id));
	}, id => {
		const vertex = graph.getVertex(id);
		return DfgVertex.isFunctionDefinition(vertex) ? new Set(own(id, vertex)) : undefined;
	}, new Set(), unionOfSets);
	return new Map(graph.verticesOfType(VertexType.FunctionDefinition).map(([id]) => [id, summaries.of(id)]));
}

/**
 * A promise is forced when the callee first needs it, which may be after the call wrote what the promise reads
 * (`g <- function(b) { x <<- 1; b }; g(x)`) or after another argument did (`f(n, n <- 4)`), so a read within an
 * argument of a call of a closure may see what the call or the other arguments write.
 */
export function linkPromisesToWritesOfCall(this: void, graph: DataflowGraph): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const nameOf = (id: NodeId) => {
		const node = idMap.get(id);
		return RSymbol.is(node) ? Identifier.getName(node.content) : undefined;
	};
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(!Dataflow.targetsOf(graph, id, EdgeType.Calls).some(t => DfgVertex.isFunctionDefinition(graph.getVertex(t)))) {
			continue;
		}
		const args = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => new Set(RNode.collectAllIds(idMap.get(a.nodeId))));
		/* what each write is named, and the argument it is written in, if any */
		const writes = new Map<string, [NodeId, ReadonlySet<NodeId> | undefined][]>();
		const write = (name: string | undefined, def: NodeId, within?: ReadonlySet<NodeId>) => {
			if(name !== undefined) {
				writes.set(name, [...writes.get(name) ?? [], [def, within]]);
			}
		};
		for(const def of Dataflow.sourcesOf(graph, id, EdgeType.SideEffectOnCall)) {
			write(NodeId.isBuiltIn(def) ? undefined : nameOf(def), def);
		}
		for(const arg of args) {
			for(const node of arg) {
				write(DfgVertex.isVariableDefinition(graph.getVertex(node)) ? nameOf(node) : undefined, node, arg);
			}
		}
		if(writes.size === 0) {
			continue;
		}
		for(const arg of args) {
			for(const node of arg) {
				const name = DfgVertex.isUse(graph.getVertex(node)) ? nameOf(node) : undefined;
				for(const [def, within] of name === undefined ? [] : writes.get(name) ?? []) {
					if(within !== arg) {
						graph.addEdge(node, def, EdgeType.Reads);
					}
				}
			}
		}
	}
}

/**
 * Links every materialized package-export vertex back to the `library()`/`use()` call that loaded it,
 * reading the loading call from the export binding's `definedAt` in the (final, authoritative) environment.
 * Only vertices created on demand (exports actually referenced) get an edge, keeping the graph small.
 */
export function linkMaterializedExportsToLoaders(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): void {
	/* the attached namespaces hold every export of every package, far more than the graph ever materializes, so the
	 * cheap direction is to ask the graph first: an export earns an edge only if it is a vertex or something points
	 * to it, called or read as a value (`g <- select`). Both are read off the graph once here instead of per export binding. */
	const called = new Set<NodeId>(graph.vertices(true).map(([id]) => id).filter(NodeId.isBuiltIn));
	for(const [, outgoing] of graph.edges()) {
		for(const target of outgoing.keys()) {
			if(NodeId.isBuiltIn(target)) {
				called.add(target);
			}
		}
	}
	if(called.size === 0) {
		return;
	}
	/* export node id -> its loading `library()`/`use()` call, from the final environment */
	const loaders = new Map<NodeId, NodeId>();
	for(const e of REnvironment.frames(environment.current)) {
		if(e.t !== EnvType.Namespace) {
			continue;
		}
		for(const defs of e.memory.values()) {
			for(const d of defs) {
				if(called.has(d.nodeId) && !NodeId.isBuiltIn(d.definedAt)) {
					loaders.set(d.nodeId, d.definedAt);
				}
			}
		}
	}
	/* the loader targets are `library()` call ids, never export ids, so the edges added here never make a further
	 * export qualify -- the lazy checks this replaces could not have observed one either */
	for(const [id, loadedAt] of loaders) {
		/* an export only read as a value (`g <- select`) has no vertex yet, which a slice could not pass */
		attachExportVertex(graph, id, environment, ctx);
		graph.addEdge(id, loadedAt, EdgeType.Reads | EdgeType.Calls);
	}
}

/** The packages (see {@link EnvType}) attached directly within a function body, i.e. its own `library()` calls. */
function ownLibraryCalls(_id: NodeId, fdef: DataflowGraphVertexFunctionDefinition): { pack: string, definedAt: NodeId }[] {
	const packages: { pack: string, definedAt: NodeId }[] = [];
	for(const e of REnvironment.frames(fdef.subflow.environment.current)) {
		if(e.t === EnvType.Namespace && e.n !== undefined) {
			/* an export binding carries the loading `library()` call in `definedAt` */
			let definedAt: NodeId = NodeId.toBuiltIn(e.n);
			for(const defs of e.memory.values()) {
				const real = defs.find(d => !NodeId.isBuiltIn(d.definedAt));
				if(real !== undefined) {
					definedAt = real.definedAt;
					break;
				}
			}
			packages.push({ pack: e.n, definedAt });
		}
	}
	return packages;
}

/** The scopes outside a function's own frame, i.e. those a definition of its body can have escaped into. */
function escapeTargetFrames(fdef: DataflowGraphVertexFunctionDefinition): Generator<Environment, void, undefined> {
	return REnvironment.frames(fdef.subflow.environment.current.parent);
}

/**
 * The non-built-in definitions a function body lets escape to an outer scope (e.g. a `<<-` super-assignment),
 * as a callback for {@link computeCallGraphSummaries}. Nested definitions share their outer frames, and a frame is
 * dominated by the built-ins it holds, so filtering each frame once per pass saves the bulk of the work.
 */
function escapedDefinitions(this: void, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>): (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => readonly NodeId[] {
	const perFrame = new Map<MemoryView, readonly NodeId[]>();
	return (_id, fdef) => {
		const defs: NodeId[] = hidden.keys().filter(call => fdef.subflow.graph.has(call)).toArray();
		for(const e of escapeTargetFrames(fdef)) {
			let escaped = perFrame.get(e.memory);
			if(escaped === undefined && e.memory instanceof Frame && e.memory.lazy() !== undefined) {
				/* an attached package binds nothing but its exports, which are built-ins */
				escaped = [];
				perFrame.set(e.memory, escaped);
			} else if(escaped === undefined) {
				/* a package frame holds thousands of entries and keeps none of them, so this walks them in place
				 * rather than through a spread/flatMap/filter/map chain that allocates an array per step */
				const collected: NodeId[] = [];
				for(const ds of e.memory.values()) {
					for(const d of ds) {
						if(!NodeId.isBuiltIn(d.nodeId)) {
							collected.push(d.nodeId);
						}
					}
				}
				escaped = collected;
				perFrame.set(e.memory, escaped);
			}
			for(const d of escaped) {
				/* a package the caller attached is visible in the body, but only one the body attaches escapes it */
				if(e.t === undefined || fdef.subflow.graph.has(d)) {
					defs.push(d);
				}
			}
		}
		return defs;
	};
}

/** Emits {@link EdgeType.SideEffectOnCall} edges for definitions that escape a function transitively. */
function propagateTransitiveDefinitions(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, summary: ReadonlyMap<NodeId, ReadonlySet<NodeId>>): void {
	for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
		for(const target of Dataflow.calleeIdsOf(graph, id)) {
			for(const def of summary.get(target) ?? []) {
				/* an escaping package export is only in the environment; materialize its vertex on demand */
				if(NodeId.isBuiltIn(def)) {
					attachExportVertex(graph, def, environment, ctx);
				}
				graph.addEdge(def, id, EdgeType.SideEffectOnCall);
			}
		}
	}
}

/**
 * Attaches packages transitively loaded by top-level calls to `environment`.
 * `g <- function() library(A); f <- function() g(); f()` makes `A` available after `f()`.
 * @returns the enriched environment and whether it grew (so the caller can re-link and re-run to a fixpoint).
 */
function propagateTransitivePackages(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): { environment: REnvironmentInformation, grew: boolean } {
	const summary = computeCallGraphSummaries(graph, ownLibraryCalls);
	/* package to its loading `library()` call and, unless a call reaching it surely runs, the cds of one that may */
	const reachable = new Map<string, { definedAt: NodeId, cds: readonly ControlDependency[] | undefined }>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(!graph.isRoot(id)) {
			continue;
		}
		const cds = happensInEveryBranch(vertex.cds) ? undefined : vertex.cds;
		for(const target of Dataflow.calleeIdsOf(graph, id)) {
			for(const { pack, definedAt } of summary.get(target) ?? []) {
				const known = reachable.get(pack);
				if(known === undefined || (known.cds !== undefined && cds === undefined)) {
					reachable.set(pack, { definedAt, cds });
				}
			}
		}
	}
	let grew = false;
	for(const [pack, { definedAt, cds }] of reachable) {
		const next = attachLibrary(pack, ctx.deps.getDependency(pack), environment, ctx, {}, definedAt, cds);
		if(next !== environment) {
			environment = next;
			grew = true;
		}
	}
	return { environment, grew };
}

type NamedDefinition = InGraphIdentifierDefinition & { name: string };

/** The ambient writes of body calls only linking resolved to a built-in (see {@link writesOfHiddenBuiltIn}), recording and linking their reads as well. */
function hiddenBuiltInWrites(graph: DataflowGraph, environment: REnvironmentInformation, drawing: boolean): Map<NodeId, NamedDefinition[]> {
	const { writes, reads, targets } = hiddenBuiltInAccess(graph, REnvironment.findBuiltIn(environment.current), drawing);
	for(const [id, resolved] of targets) {
		hiddenSideEffects(graph, environment, id, resolved);
	}
	for(const id of new Set([...writes.keys(), ...reads.keys()])) {
		graph.recordAmbientAccess(id, { reads: reads.get(id), writes: writes.get(id)?.map(d => d.name) });
	}
	linkHiddenReads(graph, reads);
	return writes;
}

/** The ambient writes and reads of body calls only linking resolved to a built-in, per call, with the built-ins each was resolved to. Does not change the graph. */
function hiddenBuiltInAccess(graph: DataflowGraph, builtIns: Environment, drawing: boolean): { writes: Map<NodeId, NamedDefinition[]>, reads: Map<NodeId, string[]>, targets: [NodeId, readonly IdentifierDefinition[]][] } {
	const writes = new Map<NodeId, NamedDefinition[]>();
	const reads = new Map<NodeId, string[]>();
	const resolvedTargets: [NodeId, readonly IdentifierDefinition[]][] = [];
	const writesOf = new DefaultMap<NodeId, NamedDefinition[]>(() => [], writes);
	const readsOf = new DefaultMap<NodeId, string[]>(() => [], reads);
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(graph.isRoot(id) || !reachesBuiltInLate(vertex)) {
			continue;
		}
		const own = DfgVertex.hasOrigin(vertex, BuiltInProcName.Function) ? undefined : vertex.name;
		for(const target of Dataflow.targetsOf(graph, id, EdgeType.Calls)) {
			if(NodeId.isBuiltIn(target) && (own === undefined || NodeId.toBuiltIn(Identifier.getName(own)) !== target)) {
				const targets = Resolve.byNameAndType(NodeId.fromBuiltIn(target), { current: builtIns, level: 0 }, ReferenceType.Function) ?? [];
				resolvedTargets.push([id, targets]);
				const defs = targets.flatMap(d => writesOfHiddenBuiltIn(d, id, drawing));
				if(defs.length > 0) {
					writesOf.get(id).push(...defs);
				}
				const names = targets.flatMap(readsOfHiddenBuiltIn);
				if(names.length > 0) {
					readsOf.get(id).push(...names);
				}
			}
		}
	}
	return { writes, reads, targets: resolvedTargets };
}

/** A hidden call reads the state where the functions running it are called. */
function linkHiddenReads(graph: DataflowGraph, reads: ReadonlyMap<NodeId, readonly string[]>): void {
	if(reads.size === 0) {
		return;
	}
	const summary = computeCallGraphSummaries(graph, (_id, fdef) => reads.keys().filter(call => fdef.subflow.graph.has(call)));
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(vertex.environment === undefined) {
			continue;
		}
		for(const target of Dataflow.calleeIdsOf(graph, id)) {
			for(const call of summary.get(target) ?? []) {
				for(const name of reads.get(call) ?? []) {
					for(const def of Resolve.byName(name, vertex.environment) ?? []) {
						if(def.nodeId !== call && graph.hasVertex(def.nodeId)) {
							graph.addEdge(call, def.nodeId, EdgeType.Reads);
						}
					}
				}
			}
		}
	}
}

/**
 * Maps each definition escaping into the global frame to its full (name-carrying) definitions, one node may define several names
 * (`options(digits = 3)`); a write from a function defined within another one may be caught by that function's frame instead.
 */
function escapedDefinitionMap(graph: DataflowGraph, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>): Map<NodeId, NamedDefinition[]> {
	const map = new Map<NodeId, NamedDefinition[]>(hidden.entries().map(([id, defs]) => [id, [...defs]]));
	const definitionsOf = new DefaultMap<NodeId, NamedDefinition[]>(() => [], map);
	const seen = new Set<MemoryView>();
	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const global = escapeTargetFrames(vertex).filter(e => e.t === undefined).reduce<Environment | undefined>((_, e) => e, undefined);
		/* a frame shared with an already-visited definition contributes the same entries */
		if(global !== undefined && !seen.has(global.memory)) {
			seen.add(global.memory);
			for(const definitions of global.memory.values()) {
				for(const def of definitions) {
					if(!NodeId.isBuiltIn(def.nodeId) && def.name !== undefined) {
						definitionsOf.get(def.nodeId).push(def as NamedDefinition);
					}
				}
			}
		}
	}
	return map;
}

/**
 * Folds the `<<-` definitions that escape transitively from top-level calls into `environment`.
 * `f <- function() x <<- 1; g <- function() f(); g(); print(x)` makes `x` resolvable.
 * @returns the enriched environment and whether it grew (so the extractor can re-resolve open reads and re-run).
 */
function propagateTransitiveEscapedDefinitions(graph: DataflowGraph, environment: REnvironmentInformation, defined: Set<string>, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>, summary: ReadonlyMap<NodeId, ReadonlySet<NodeId>>, open: readonly IdentifierReference[]): { environment: REnvironmentInformation, grew: boolean, names: Set<string> } {
	const defs = escapedDefinitionMap(graph, hidden);
	const names = new Set<string>();
	let byName: DefaultMap<string, NodeId[]> | undefined;
	const definitionsNamed = (name: string) => (byName ??= Dataflow.definitionsByName(graph)).get(name);
	let grew = false;
	for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(!graph.isRoot(id)) {
			continue;
		}
		for(const target of Dataflow.calleeIdsOf(graph, id)) {
			for(const def of (summary.get(target) ?? []).values().flatMap(nodeId => defs.get(nodeId) ?? [])) {
				const nodeId = def.nodeId;
				names.add(def.name);
				/* a name may hold several definitions while a lookup answers with one, so asking the environment
				 * would call every shadowed one missing and define it again on every round; what this fixpoint
				 * has already folded in is what says whether there is anything left to add */
				const key = `${def.name}\u0000${String(nodeId)}`;
				if(defined.has(key)) {
					continue;
				}
				defined.add(key);
				if(Resolve.byNameAndType(def.name, environment, def.type)?.some(d => d.nodeId === nodeId)) {
					continue;
				}
				environment = REnvironment.define(def, false, environment);
				linkReadsAfter(graph, id, def, open, definitionsNamed);
				grew = true;
			}
		}
	}
	return { environment, grew, names };
}

/**
 * A read that may run after `call` and sees a definition the call may replace (or nothing, as with the `open` reads) may see `def`
 * instead, as with a callee only the call binds: `g <- function(f) f(); x <- 1; g(function() x <<- 2); print(x)`, or `g(runif)`.
 */
function linkReadsAfter(graph: DataflowGraph, call: NodeId, def: NamedDefinition, open: readonly IdentifierReference[], definitionsNamed: (name: string) => readonly NodeId[]): void {
	const before = graph.getVertex(call)?.environment;
	const visible = before === undefined ? definitionsNamed(def.name) : Resolve.byName(def.name, before)?.map(d => d.nodeId) ?? [];
	const replaced = new Set([...visible, ...Dataflow.sourcesOf(graph, call, EdgeType.SideEffectOnCall)]);
	const readers = new Set(open.filter(r => r.name === def.name).map(r => r.nodeId));
	for(const [id] of graph.vertices(true)) {
		/* an argument reads the value of a call, not a name the call may define (an ambient state is defined at its call) */
		if((readers.has(id) || graph.edgesFrom(id).entries().some(([target, edge]) => DfEdge.includesType(edge, EdgeType.Reads) && DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && replaced.has(target)))
			&& !ProgramOrder.definedLater(call, ProgramOrder.runsOnceAt(id, graph), graph)) {
			graph.addEdge(id, def.nodeId, EdgeType.Reads);
		}
	}
}

/** Re-resolves still-open reads whose name is one of the transitively escaped `<<-` definitions in `escapedNames`, adding {@link EdgeType.Reads} edges. */
export function reResolveOpenReferences(this: void, graph: DataflowGraph, environment: REnvironmentInformation, references: readonly IdentifierReference[], escapedNames: ReadonlySet<string>): void {
	for(const ref of references) {
		if(ref.name === undefined || !escapedNames.has(Identifier.toString(ref.name))) {
			continue;
		}
		for(const { nodeId } of Resolve.byNameAndType(ref.name, environment, ref.type) ?? []) {
			if(!NodeId.isBuiltIn(nodeId) && nodeId !== ref.nodeId) {
				graph.addEdge(ref.nodeId, nodeId, EdgeType.Reads);
			}
		}
	}
}

/** What calling a function may leave changed, see {@link ambientWritesOfFunctions}. */
export interface FunctionAmbientWrites {
	/** the pseudo variables of the state it may change (see {@link AmbientStateName}), like `#option:digits` */
	readonly state:     ReadonlySet<string>
	/** the state only assumed changed by a body flowR cannot see and changed by nothing else, like `#rng` for `function(f) f()` */
	readonly assumed:   ReadonlySet<string>
	/** the global variables it may bind, by `x <<- 1` reaching the global frame or `assign("x", 1, envir = .GlobalEnv)` */
	readonly variables: ReadonlySet<string>
}

/** What running some code reads and writes of the global state, see {@link ambientAccessOf}. */
export interface AmbientAccess {
	/** the pseudo variables (see {@link AmbientStateName}) the code may read, like `#option:digits` */
	readonly reads:     ReadonlySet<string>
	/** the pseudo variables of the state it may change, like `#option:digits` */
	readonly writes:    ReadonlySet<string>
	/** the state only assumed changed by a body flowR cannot see and changed by nothing else, like `#rng` for `function(f) f()` */
	readonly assumed:   ReadonlySet<string>
	/** the global variables the functions it calls may bind, by `x <<- 1` reaching the global frame or `assign("x", 1, envir = .GlobalEnv)` */
	readonly variables: ReadonlySet<string>
	/** the calls tagged {@link SemanticCallTag.Graphics} (`plot`, `lines`, `par`, ...), which write the canvas only if `semantics.ambient.drawingWritesDevice` is set */
	readonly draws:     ReadonlySet<NodeId>
}

/** Which of the {@link AmbientAccess} to take along when asking {@link ambientAccessOf}. */
export interface AmbientAccessOptions {
	/** whether to add what the functions called by the code access as well, defaults to true */
	readonly includeCallees?: boolean
}

const Reads = 'r', Writes = 'w', Assumed = 'a', Variable = 'v';

function accessOf(items: Iterable<string>, draws: ReadonlySet<NodeId>): AmbientAccess {
	const access = { reads: new Set<string>(), writes: new Set<string>(), assumed: new Set<string>(), variables: new Set<string>() };
	const byKind: Record<string, Set<string>> = { [Reads]: access.reads, [Writes]: access.writes, [Assumed]: access.assumed, [Variable]: access.variables };
	for(const item of items) {
		byKind[item[0]].add(item.slice(1));
	}
	return { ...access, assumed: access.assumed.difference(access.writes), draws };
}

function itemsOf(record: AmbientAccessRecord): string[] {
	return [...record.reads.map(n => Reads + n), ...record.writes.map(n => Writes + n), ...record.assumed.map(n => Assumed + n)];
}

/** The dataflow graph of the whole program, with the environment of the analysis to know its configured built-ins (without, the defaults answer). */
export type AmbientSource = DataflowGraph | (Pick<DataflowInformation, 'graph'> & Partial<Pick<DataflowInformation, 'environment'>>);

function graphOf(from: AmbientSource): [DataflowGraph, REnvironmentInformation | undefined] {
	return 'graph' in from ? [from.graph, from.environment] : [from, undefined];
}

/** Whether the call `id` is tagged as a graphics call, or reaches one through a parameter (`g <- function(f) f(1); g(plot)`). */
function drawsOn(graph: DataflowGraph, id: NodeId, environment: REnvironmentInformation | undefined): boolean {
	const draws = (info: BuiltInFnInfo | undefined) => FunctionSemantics.call.props.hasAny(info, SemanticCallTag.Graphics);
	if(draws(callFnProps(id, graph, environment))) {
		return true;
	}
	const builtIns = environment === undefined ? undefined : { level: 0, current: REnvironment.findBuiltIn(environment.current) };
	return Dataflow.targetsOf(graph, id, EdgeType.Calls).some(t => NodeId.isBuiltIn(t)
		&& draws(builtIns === undefined ? BuiltInIndex.default().get(NodeId.fromBuiltIn(t)) : queryFnProps(NodeId.fromBuiltIn(t), { environment: builtIns })));
}

/**
 * What each function accesses when it is called: the pseudo variables it reads and changes (see {@link AmbientStateName}), the global
 * variables it binds and the drawing calls it makes, together with what the functions it calls access.
 * Reads and writes confined to the function's own frame (`withr::local_options`) are left out.
 * @param from - see {@link AmbientSource}
 * @returns      per function-definition vertex what it may access, which is empty for a function accessing nothing
 * @useInstead {@link Dataflow.sideEffects.ambientAccessOfFunctions}
 */
export function ambientAccessOfFunctions(this: void, from: AmbientSource): Map<NodeId, AmbientAccess> {
	const [graph, environment] = graphOf(from);
	const names = escapedDefinitionMap(graph, new Map());
	const escaped = escapedDefinitions(new Map());
	const items = computeCallGraphSummaries(graph, (id, fdef) => {
		const own = Dataflow.callsIn(fdef, graph).flatMap(([call]) => {
			const record = graph.ambientAccessOf(call);
			return record === undefined ? [] : itemsOf(record);
		}).toArray();
		for(const def of escaped(id, fdef)) {
			for(const { name } of names.get(def) ?? []) {
				if(!AmbientStateName.is(name)) {
					own.push(Variable.concat(name));
				}
			}
		}
		return own;
	});
	const draws = computeCallGraphSummaries(graph, (_id, fdef) => Dataflow.callsIn(fdef, graph).map(([call]) => call).filter(call => drawsOn(graph, call, environment)));
	return new Map(items.entries().map(([id, own]) => [id, accessOf(own, draws.get(id) ?? new Set())]));
}

/** Adds the ids of every file a `source` call among `ids` runs, transitively, found by where the call continues with another file. */
function addSourcedFiles(graph: DataflowGraph, ids: Set<NodeId>): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const todo = [...ids];
	while(todo.length > 0) {
		const id = todo.pop() as NodeId;
		if(!DfgVertex.hasOrigin(graph.getVertex(id), BuiltInProcName.Source)) {
			continue;
		}
		const file = idMap.get(id)?.info.file;
		for(const next of Dataflow.targetsOf(graph, id, EdgeType.FlowEdge)) {
			const node = idMap.get(next);
			if(node === undefined || node.info.file === file || ids.has(next)) {
				continue;
			}
			const root = RNode.iterateParents(node, idMap).reduce((_, parent) => parent, node);
			for(const inner of RNode.collectAllIds(root)) {
				if(!ids.has(inner)) {
					ids.add(inner);
					todo.push(inner);
				}
			}
		}
	}
}

/**
 * What running the given code reads and writes of the global state, see {@link AmbientAccess}: the calls among `scope` and,
 * unless turned off, what the functions they call access. The calls within a function definition in `scope` only count if called.
 * @param from  - see {@link AmbientSource}
 * @param scope - the ids to ask for, like those of a file, a block, or a single statement (see `RNode.collectAllIds`), or one id
 * @param opts  - see {@link AmbientAccessOptions}
 * @useInstead {@link Dataflow.sideEffects.ambientAccess}
 */
export function ambientAccessOf(this: void, from: AmbientSource, scope: NodeId | Iterable<NodeId>, opts?: AmbientAccessOptions): AmbientAccess {
	const [graph, environment] = graphOf(from);
	const ids = new Set<NodeId>(typeof scope === 'string' || typeof scope === 'number' ? [scope] : scope);
	addSourcedFiles(graph, ids);
	/* the bodies of nested definitions, exit hooks among them, are no part of the scope (`collectAllIds` misses the hooks) */
	const bodies = new Set<NodeId>();
	const definitions = [...ids];
	while(definitions.length > 0) {
		const vertex = graph.getVertex(definitions.pop() as NodeId);
		if(DfgVertex.isFunctionDefinition(vertex)) {
			for(const inner of vertex.subflow.graph) {
				if(!bodies.has(inner)) {
					bodies.add(inner);
					definitions.push(inner);
				}
			}
		}
	}
	const items: string[] = [];
	const draws = new Set<NodeId>();
	const callees = new Set<NodeId>();
	for(const id of ids) {
		if(bodies.has(id) || !DfgVertex.isFunctionCall(graph.getVertex(id))) {
			continue;
		}
		const record = graph.ambientAccessOf(id);
		if(record !== undefined) {
			items.push(...itemsOf(record));
		}
		if(drawsOn(graph, id, environment)) {
			draws.add(id);
		}
		if(opts?.includeCallees !== false) {
			for(const callee of Dataflow.calleeIdsOf(graph, id)) {
				callees.add(callee);
			}
		}
		/* a call the call makes without a node of its own (`eval(call("f"))`, `do.call(name)`) is part of it */
		for(const made of Dataflow.targetsOf(graph, id, EdgeType.Calls)) {
			if(graph.idMap?.has(made) === false && DfgVertex.isFunctionCall(graph.getVertex(made))) {
				ids.add(made);
			}
		}
	}
	if(callees.size > 0) {
		const functions = ambientAccessOfFunctions(from);
		for(const callee of callees) {
			const access = functions.get(callee);
			if(access !== undefined) {
				items.push(...access.reads.values().map(n => Reads + n), ...access.writes.values().map(n => Writes + n), ...access.assumed.values().map(n => Assumed + n), ...access.variables.values().map(n => Variable + n));
				access.draws.forEach(d => draws.add(d));
			}
		}
	}
	return accessOf(items, draws);
}

/**
 * The global state each function may leave changed when it is called, as the names of the pseudo variables it changes
 * (see {@link AmbientStateName}): `#option:digits` for `options(digits = 3)`, `#env:PATH` for `Sys.setenv(PATH = "")`, or `#sink`,
 * and the global variables it binds.
 * A function reports what its callees report as well, so with `a01 <- function() options(digits = 3)` and `a22 <- function() a01()`,
 * both set `#option:digits`. What a function only changes within its own frame (`withr::local_options`) is left out.
 * @param info - see {@link AmbientSource}
 * @returns      per function-definition vertex what it may change, which is empty for a function changing nothing
 * @useInstead {@link Dataflow.sideEffects.ambientAccessOfFunctions}
 */
export function ambientWritesOfFunctions(this: void, info: AmbientSource): Map<NodeId, FunctionAmbientWrites> {
	return new Map(ambientAccessOfFunctions(info).entries().map(([id, { writes, assumed, variables }]) => [id, { state: writes, assumed, variables }]));
}

/**
 * Propagates every function's escaped side effects (attached packages and `<<-` definitions) to its transitive callers.
 * @returns  the enriched top-level environment and whether it grew (so the extractor can re-link and re-run to a fixpoint).
 * @useInstead {@link Dataflow.sideEffects.propagateTransitive}
 */
export function propagateTransitiveSideEffects(this: void, graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, defined: Set<string> = new Set(), open: readonly IdentifierReference[] = []): { environment: REnvironmentInformation, grew: boolean, escapedNames: Set<string> } {
	const hidden = hiddenBuiltInWrites(graph, environment, drawingWritesDevice(ctx.config));
	/* both passes ask what escapes each function, and neither changes a body or a call target in between */
	const escapes = computeCallGraphSummaries(graph, escapedDefinitions(hidden));
	propagateTransitiveDefinitions(graph, environment, ctx, escapes);
	const packages = propagateTransitivePackages(graph, environment, ctx);
	const escaped = propagateTransitiveEscapedDefinitions(graph, packages.environment, defined, hidden, escapes, open);
	return { environment: escaped.environment, grew: packages.grew || escaped.grew, escapedNames: escaped.names };
}
