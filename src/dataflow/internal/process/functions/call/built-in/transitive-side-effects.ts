import { type DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { DfEdge, EdgeType } from '../../../../../graph/edge';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EnvType, type Environment, REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachExportVertex, attachLibrary } from './built-in-library';
import type { NamedInGraphIdentifierDefinition, BrandedIdentifier, BrandedNamespace, IdentifierDefinition, IdentifierReference } from '../../../../../environments/identifier';
import { Frame, type MemoryView } from '../../../../../environments/frame-memory';
import { DfgVertex, VertexType } from '../../../../../graph/vertex';
import { RLoopConstructs, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RProject } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { ProgramOrder } from '../../../../program-order';
import { Resolve } from '../../../../../environments/resolve-helper';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { drawingWritesDevice, hiddenSideEffects, reachesBuiltInLate, readsOfHiddenBuiltIn, writesOfHiddenBuiltIn } from './built-in-ambient-state';
import { DefaultMap, memoize } from '../../../../../../util/collections/defaultmap';
import { Dataflow } from '../../../../../graph/df-helper';
import { type AmbientFamily, AmbientStateName, GraphicsDevices, OutputSinks } from '../../../../../environments/ambient-state-name';
import { AmbientAccess, AmbientAccessKind } from '../../../../../graph/ambient-access';
import { BuiltInIndex, callFnProps, queryFnProps } from '../../../../../environments/query-fn-props';
import { ArgProp, type BuiltInFnInfo, FnSig } from '../../../../../environments/built-in-props';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { SemanticCallTag } from '../../../../../environments/built-in-props';
import { Ternary } from '../../../../../../util/logic';
import { type DataflowInformation, ControlDependency, ExitPointType, happensInEveryBranch } from '../../../../../info';
import { ReachSummaries } from '../../../../../../util/fixpoint';
import { Monoid } from '../../../../../../util/monoid';
import { Relation } from '../../../../../../util/collections/relation';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { RValue } from '../../../../../eval/values/r-value';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { removedNameOf } from '../../../../../environments/removal-marker';
import { isBaseRPackage } from '../../../../../../util/r-base-packages';

/**
 * Computes, for every function-definition vertex `F`, `summary(F) = own(F)` unioned with `summary(G)` over every transitive callee `G`.
 * @useInstead {@link Dataflow.sideEffects.callGraphSummaries}
 */
export function computeCallGraphSummaries<T>(this: void, graph: DataflowGraph, own: (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => Iterable<T>): Relation<NodeId, T> {
	return foldCallGraph(graph, Monoid.set<T>(), (id, fdef) => new Set(own(id, fdef)));
}

/**
 * Computes, for every function-definition vertex `F`, what `F` and every function it transitively calls contribute together.
 * @useInstead {@link Dataflow.sideEffects.foldCallGraph}
 */
export function foldCallGraph<M>(this: void, graph: DataflowGraph, monoid: Monoid<M>, own: (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => M): Map<NodeId, M> {
	const summaries = new ReachSummaries<NodeId, M>(id => {
		const vertex = graph.getVertex(id);
		if(!DfgVertex.isFunctionDefinition(vertex)) {
			return [];
		}
		/* an exit hook (`on.exit(expr)`) runs as part of the function */
		return Dataflow.callsIn(vertex, graph).flatMap(([node]) => Dataflow.calleeIdsOf(graph, node)).toArray().concat(vertex.subflow.hooks.map(h => h.id));
	}, id => {
		const vertex = graph.getVertex(id);
		return DfgVertex.isFunctionDefinition(vertex) ? own(id, vertex) : undefined;
	}, monoid);
	return new Map(graph.verticesOfType(VertexType.FunctionDefinition).map(([id]) => [id, summaries.of(id)]));
}

/** A promise reads the state at the point it is forced, which is wherever the callee first needs it: after the call wrote what the promise reads (`g <- function(b) { x <<- 1; b }; g(x)`), after another argument did (`f(n, n <- 4)`), or, once a closure captured its parameter, after the call returned (`mk <- function(a) function() a`). */
export function linkPromisesToWritesOfCall(this: void, graph: DataflowGraph, ctx: FlowrAnalyzerContext): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const nameOf = (id: NodeId) => {
		const node = idMap.get(id);
		return RSymbol.is(node) ? Identifier.getName(node.content) : undefined;
	};
	let outlives: ((parameter: NodeId) => boolean) | undefined;
	let later: ((call: NodeId, name: BrandedIdentifier) => readonly NodeId[]) | undefined;
	let forcing: ((holder: NodeId, inner: NodeId) => Ternary) | undefined;
	let order: PromiseOrder | undefined;
	let functions: ReadonlyMap<NodeId, AmbientAccess> | undefined;
	/* the global state a closure changes while it runs, which a promise it forces may see */
	const changedBy = (fns: readonly NodeId[]) => {
		functions ??= ambientAccessOfFunctions(graph);
		return Monoid.fold(AmbientAccess.monoid, fns.map(fn => functions?.get(fn) ?? AmbientAccess.empty));
	};
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		/* a function of a package flowR has no body for forces its arguments as its signature states, see `keptPromisesOfPackageCall` */
		const kept = Dataflow.targetsOf(graph, id, EdgeType.Calls).some(t => !NodeId.isBuiltIn(t) && DfgVertex.isFunctionDefinition(graph.getVertex(t)))
			? undefined : keptPromisesOfPackageCall(graph, vertex, ctx);
		if(kept === false) {
			continue;
		}
		const args = vertex.args.filter(FunctionArgument.isNotEmpty).map(a => ({ ids: new Set(RNode.collectAllIds(idMap.get(a.nodeId))), at: a.nodeId }));
		/* what each write is named, and the argument it is written in, if any */
		const writes = new Map<BrandedIdentifier, [NodeId, ReadonlySet<NodeId> | undefined][]>();
		const write = (name: BrandedIdentifier | undefined, def: NodeId, within?: ReadonlySet<NodeId>) => {
			if(name !== undefined) {
				writes.set(name, [...writes.get(name) ?? [], [def, within]]);
			}
		};
		for(const def of Dataflow.sourcesOf(graph, id, EdgeType.SideEffectOnCall)) {
			write(NodeId.isBuiltIn(def) ? undefined : nameOf(def), def);
		}
		for(const { ids } of args) {
			for(const node of ids) {
				write(DfgVertex.isVariableDefinition(graph.getVertex(node)) ? nameOf(node) : undefined, node, ids);
			}
		}
		const closures = kept === undefined ? Dataflow.calleeIdsOf(graph, id).filter(t => !NodeId.isBuiltIn(t)) : [];
		for(const { ids } of closures.length > 0 ? args : []) {
			linkAmbientReadsToWrites(graph, ids, () => changedBy(closures));
		}
		for(const { ids, at } of args) {
			/* whether the promise may be forced after the call, asked only once a read has a later definition to see */
			let late: boolean | undefined;
			const outlived = () => {
				/* resolving the condition of each branch to a constant would cost a value resolution per branch */
				forcing ??= FunctionSemantics.promiseForcing(graph, { ctx, constantBranches: false });
				outlives ??= promiseOutlivesCall(graph, idMap, forcing);
				late ??= kept === undefined ? Dataflow.targetsOf(graph, at, EdgeType.DefinesOnCall).some(outlives) && forcing(id, at) !== Ternary.Always : kept.has(at);
				return late;
			};
			for(const node of ids) {
				const name = DfgVertex.isUse(graph.getVertex(node)) ? nameOf(node) : undefined;
				if(name === undefined) {
					continue;
				}
				for(const [def, within] of writes.get(name) ?? []) {
					if(within !== ids) {
						graph.addEdge(node, def, EdgeType.Reads);
					}
				}
				later ??= definitionsAfter(graph, idMap);
				const after = later(id, name);
				if(after.length > 0 && outlived()) {
					for(const def of after) {
						graph.addEdge(node, def, EdgeType.Reads);
					}
				}
				(order ??= new PromiseOrder(graph, idMap)).settle(id, at, node, name);
			}
		}
	}
	for(const [fn] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const definition = idMap.get(fn);
		for(const parameter of RFunctionDefinition.is(definition) ? definition.parameters : []) {
			if(parameter.defaultValue !== undefined) {
				linkAmbientReadsToWrites(graph, RNode.collectAllIds(parameter.defaultValue), () => changedBy([fn]));
			}
			for(const read of parameter.defaultValue === undefined ? [] : RNode.collectAllIds(parameter.defaultValue)) {
				const name = DfgVertex.isUse(graph.getVertex(read)) ? nameOf(read) : undefined;
				if(name !== undefined) {
					(order ??= new PromiseOrder(graph, idMap)).settleDefault(fn, parameter.name.info.id, read, name);
				}
			}
		}
	}
}

/** A promise (`delayedAssign`) forced where its name is not read at the top level, by a call running a closure that reads it or by an access of an environment holding it, changes the state at that point, which later code reading the state sees. */
export function linkStateWritesOfForcedPromises(this: void, graph: DataflowGraph): void {
	let readers: ReadonlyMap<NodeId, ReadonlySet<AmbientStateName>> | undefined;
	for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
		const binding = FunctionSemantics.call.quoted.promisedBinding(graph, id);
		const promise = binding === undefined ? [] : Dataflow.targetsOf(graph, id, EdgeType.NonStandardEvaluation);
		const calls = promise.flatMap(p => [...RNode.collectAllIds(graph.idMap?.get(p))]).filter(c => DfgVertex.isFunctionCall(graph.getVertex(c)));
		/* the calls of the promise changing the state, which run where it is forced even if its value goes unused */
		const writers = calls.filter(c => ambientAccessOf(graph, [c])[AmbientAccessKind.Write].size > 0);
		const written = writers.length === 0 ? [] : [...ambientAccessOf(graph, writers)[AmbientAccessKind.Write].keys()];
		if(binding === undefined || written.length === 0) {
			continue;
		}
		readers ??= new Map([...graph.ambientAccessIds()].map(r => [r, new Set(graph.ambientAccessOf(r)?.[AmbientAccessKind.Read].keys())]));
		for(const site of FunctionSemantics.promiseForcingPoints(binding, graph)) {
			for(const writer of writers) {
				graph.addEdge(site, writer, EdgeType.Reads);
			}
			const statement = ProgramOrder.runsOnceAt(site, graph);
			if(statement === undefined || written.every(name => graph.ambientAccessOf(site)?.[AmbientAccessKind.Write].has(name))) {
				continue;
			}
			for(const expr of promise) {
				graph.addEdge(site, expr, EdgeType.Reads);
			}
			for(const [reader, reads] of readers) {
				if(written.some(name => reads.has(name)) && ProgramOrder.offset(reader, statement, graph) > 0) {
					graph.addEdge(reader, site, EdgeType.Reads);
				}
			}
		}
	}
}

/** The families of instances a scope may open one of for its code, see {@link linkUsesOfScopedInstances}. */
const ScopedInstances: readonly AmbientFamily[] = [OutputSinks, GraphicsDevices];

/** A scope opening an instance for its code (`capture.output`, `with_png`) ends it afterward, so it reads every use of it within its arguments, in the functions they call as well (`capture.output(f())` reads what `f` prints). */
export function linkUsesOfScopedInstances(this: void, graph: DataflowGraph): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	let functions: ReadonlyMap<NodeId, AmbientAccess> | undefined;
	for(const id of graph.ambientAccessIds()) {
		/* a scope changes the states of the instance it opens in its own frame only */
		const local = graph.ambientAccessOf(id)?.[AmbientAccessKind.Local];
		const scoped = ScopedInstances.filter(family => local?.has(family.used) && local.has(family.opened));
		const vertex = graph.getVertex(id);
		if(scoped.length === 0 || !DfgVertex.isFunctionCall(vertex)) {
			continue;
		}
		const code = vertex.args.filter(FunctionArgument.isNotEmpty).flatMap(a => [...RNode.collectAllIds(idMap.get(a.nodeId))]);
		functions ??= ambientAccessOfFunctions(graph);
		const writes = ambientAccessOf(graph, code, { functions })[AmbientAccessKind.Write];
		for(const writer of scoped.flatMap(family => [...writes.get(family.used) ?? []])) {
			if(writer !== id) {
				graph.addEdge(id, writer, EdgeType.Reads);
			}
		}
	}
}

/** What a body runs after a call of a closure within it sees the global state that closure changes, which the body, processed before it learned of the callee, does not know of: `f <- function() { g(); print(pi) }` with `g` setting the `digits` option. */
export function linkStatementsAfterCallsOfClosures(this: void, graph: DataflowGraph): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	let functions: ReadonlyMap<NodeId, AmbientAccess> | undefined;
	for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
		const closures = graph.isRoot(id) ? [] : Dataflow.calleeIdsOf(graph, id).filter(t => !NodeId.isBuiltIn(t) && DfgVertex.isFunctionDefinition(graph.getVertex(t)));
		const after = closures.length === 0 ? undefined : runsAfterWithinFunction(id, idMap);
		if(after === undefined || after.size === 0) {
			continue;
		}
		const changed = () => {
			functions ??= ambientAccessOfFunctions(graph);
			return Monoid.fold(AmbientAccess.monoid, closures.map(fn => functions?.get(fn) ?? AmbientAccess.empty));
		};
		for(const reader of linkAmbientReadsToWrites(graph, after, changed)) {
			/* the reader sees the write only as the call runs it */
			graph.addEdge(reader, id, EdgeType.Reads);
		}
	}
}

/** The nodes the function holding `id` may run after it: the later statements of each block around it, and all of a loop around it. */
function runsAfterWithinFunction(id: NodeId, idMap: AstIdMap): Set<NodeId> {
	const after = new Set<NodeId>();
	const add = (nodes: readonly RNode<ParentInformation>[]) => nodes.forEach(n => RNode.collectAllIdsWithStop(n, RFunctionDefinition.is).forEach(i => after.add(i)));
	let node = idMap.get(id);
	for(let parent = node && RNode.directParent(node, idMap); parent !== undefined && node !== undefined && !RFunctionDefinition.is(parent); parent = RNode.directParent(parent, idMap)) {
		if(RExpressionList.is(parent)) {
			add(parent.children.slice(parent.children.indexOf(node) + 1));
		} else if(RLoopConstructs.is(parent)) {
			add([parent]);
		}
		node = parent;
	}
	return after;
}

/** The calls among `ids` of a promise read the global state where it is forced, after what the function forcing it may have `changed` (`function(code) { set.seed(1); code }`); returns the readers so linked. */
function linkAmbientReadsToWrites(graph: DataflowGraph, ids: ReadonlySet<NodeId>, changed: () => AmbientAccess): NodeId[] {
	let access: AmbientAccess | undefined;
	const readers: NodeId[] = [];
	for(const node of ids) {
		for(const name of graph.ambientAccessOf(node)?.[AmbientAccessKind.Read].keys() ?? []) {
			access ??= changed();
			for(const kind of [AmbientAccessKind.Write, AmbientAccessKind.Local, AmbientAccessKind.Assumed]) {
				for(const writer of access[kind].get(name) ?? []) {
					if(!ids.has(writer)) {
						graph.addEdge(node, writer, EdgeType.Reads);
						readers.push(node);
					}
				}
			}
		}
	}
	return readers;
}

/** Whether the branches of `fn` a node stands under are taken in the frame `call` makes: a parameter holds what that call hands it, so a condition on it may be constant there. */
function branchesTakenIn(conditions: readonly ControlDependency[], fn: NodeId, call: NodeId, graph: DataflowGraph, ctx: FlowrAnalyzerContext): Ternary {
	let result = Ternary.Always;
	for(const cd of conditions) {
		const branch = graph.getVertex(cd.id);
		const condition = DfgVertex.isFunctionCall(branch) && DfgVertex.hasOrigin(branch, BuiltInProcName.IfThenElse) ? branch.args[0] : undefined;
		const values = condition === undefined || condition === EmptyArgument || cd.when === undefined ? undefined
			: NodeValue.setOf(condition.nodeId, Resolve.info(graph, ctx), { callContext: new Map([[fn, call]]) })?.elements.map(RValue.truthOf);
		const outcome = values !== undefined && values.length > 0 && values.every(v => v !== undefined && v === values[0]) ? values[0] : undefined;
		if(outcome === undefined) {
			result = Ternary.Maybe;
		} else if(outcome !== cd.when) {
			return Ternary.Never;
		}
	}
	return result;
}

/** Whether every reference to the definition is a call of it among `calls`: it is bound to names (`f <- function...`) only these calls read, so no other way leads into it. */
function onlyCalledBy(fn: NodeId, calls: ReadonlySet<NodeId>, graph: DataflowGraph): boolean {
	const binds = (source: NodeId) => DfgVertex.hasOrigin(graph.getVertex(source), BuiltInProcName.Assignment);
	const holders: NodeId[] = [];
	for(const [source, edge] of graph.edgesTo(fn)) {
		if(DfEdge.isOnlyControlFlow(edge) || binds(source) || (DfEdge.isOnlyType(edge, EdgeType.Calls) && calls.has(source))) {
			continue;
		} else if(DfEdge.includesType(edge, EdgeType.DefinedBy) && DfgVertex.isVariableDefinition(graph.getVertex(source))) {
			holders.push(source);
		} else {
			return false;
		}
	}
	return holders.every(holder => graph.edgesTo(holder).entries().every(([source, edge]) => DfEdge.isOnlyControlFlow(edge) || binds(source) || calls.has(source)));
}

/** Settles what a function writes beyond its frame (`<<-`) under branches of its own, once the calls passing the write on are linked: bound to what a call hands it, a parameter may make a branch constant (`f <- function(go) if(go) n <<- 5; f(FALSE)`). */
export function settleConditionalWritesOfCalls(this: void, graph: DataflowGraph, ctx: FlowrAnalyzerContext): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	for(const [write, vertex] of graph.verticesOfType(VertexType.VariableDefinition)) {
		const calls = Dataflow.targetsOf(graph, write, EdgeType.SideEffectOnCall);
		const fn = calls.length === 0 ? undefined : RNode.strictlyEnclosingFunction(write, idMap);
		const conditions = fn === undefined ? [] : ControlDependency.minus(vertex.cds ?? [], graph.getVertex(fn)?.cds ?? []);
		if(fn === undefined || conditions.length === 0 || calls.some(c => !Dataflow.hasEdge(graph, c, fn, EdgeType.Calls))) {
			continue;
		}
		const taken = calls.map(call => branchesTakenIn(conditions, fn, call, graph, ctx));
		if(taken.every(t => t === Ternary.Never)) {
			if(onlyCalledBy(fn, new Set(calls), graph)) {
				for(const reader of Dataflow.sourcesOf(graph, write, EdgeType.Reads)) {
					graph.removeEdgeType(reader, write, EdgeType.Reads);
				}
			}
			continue;
		}
		const definition = graph.getVertex(fn);
		const at = idMap.get(write)?.location;
		/* a return or an error before the write may end the call without it */
		const reached = DfgVertex.isFunctionDefinition(definition) && at !== undefined && RNode.strictlyEnclosingFunction(fn, idMap) === undefined
			&& !definition.exitPoints.some(e => {
				const exit = idMap.get(e.nodeId)?.location;
				return e.type !== ExitPointType.Default && (exit === undefined || exit[0] < at[0] || (exit[0] === at[0] && exit[1] <= at[1]));
			});
		for(let i = 0; reached && i < calls.length; i++) {
			const statement = taken[i] === Ternary.Always && !graph.getVertex(calls[i])?.cds?.length ? ProgramOrder.runsOnceAt(calls[i], graph) : undefined;
			if(statement !== undefined) {
				ProgramOrder.replaceEarlier(write, statement, graph, true);
			}
		}
	}
}

/** How many calls deep {@link PromiseOrder} follows a promise handed on, or a callee that writes. */
const MaxPromiseHandOn = 4;

/** When a promise is forced relative to the writes of the call it is handed to: `f <- function(a) { x <<- 2; a }` forces `a` only once `x` is replaced, so `f(x)` never sees what `x` held before the call. */
class PromiseOrder {
	private readonly graph: DataflowGraph;
	private readonly idMap: AstIdMap;

	constructor(graph: DataflowGraph, idMap: AstIdMap) {
		this.graph = graph;
		this.idMap = idMap;
	}

	/** The one definition the call is linked to, if it is a closure defined at the top level. */
	private topLevelTarget(call: NodeId): NodeId | undefined {
		const targets = Dataflow.calleeIdsOf(this.graph, call);
		const [target] = targets;
		return targets.length === 1 && !NodeId.isBuiltIn(target) && DfgVertex.isFunctionDefinition(this.graph.getVertex(target))
			&& RNode.strictlyEnclosingFunction(target, this.idMap) === undefined ? target : undefined;
	}

	/** The statements of the body of the definition, in the order they run. */
	private statementsOf(fn: NodeId): readonly RNode<ParentInformation>[] {
		const definition = this.idMap.get(fn);
		if(!RFunctionDefinition.is(definition)) {
			return [];
		}
		return RExpressionList.is(definition.body) ? definition.body.children : [definition.body];
	}

	/** Where among the statements the node is, `-1` if in none. */
	private statementIndex(id: NodeId, statements: readonly RNode<ParentInformation>[]): number {
		const node = this.idMap.get(id);
		for(const at of node === undefined ? [] : [node, ...RNode.iterateParents(node, this.idMap)]) {
			const index = statements.indexOf(at);
			if(index >= 0) {
				return index;
			}
		}
		return -1;
	}

	/** The call a statement makes on its own (`g()`) or assigns the result of (`v <- g()`). */
	private callOf(statement: RNode<ParentInformation>): NodeId | undefined {
		const vertex = this.graph.getVertex(statement.info.id);
		const value = RBinaryOp.is(statement) && DfgVertex.hasOrigin(vertex, BuiltInProcName.Assignment) ? statement.rhs : statement;
		return DfgVertex.isFunctionCall(this.graph.getVertex(value.info.id)) ? value.info.id : undefined;
	}

	/** Whether the call defines `name` in the frame it is evaluated in, with an assignment of its own. */
	private assigns(id: NodeId, name: BrandedIdentifier, origin: BuiltInProcName): boolean {
		return DfgVertex.hasOrigin(this.graph.getVertex(id), origin)
			&& Dataflow.targetsOf(this.graph, id, EdgeType.Returns).some(t => {
				const node = this.idMap.get(t);
				return DfgVertex.isVariableDefinition(this.graph.getVertex(t)) && RSymbol.is(node) && Identifier.getName(node.content) === name;
			});
	}

	/** Whether running the statement of the top-level closure `fn` surely replaces the global `name`: `name <<- v`, a call of a top-level closure surely doing so, or, for the call the promise came from, forcing another of its arguments that assigns `name` (`f(n, n <- 4)`). */
	private surelyWrites(statement: RNode<ParentInformation>, name: BrandedIdentifier, fn: NodeId, call: NodeId, depth: number): boolean {
		const id = statement.info.id;
		if(this.assigns(id, name, BuiltInProcName.SuperAssignment)) {
			return true;
		}
		if(depth === 0 && DfgVertex.isUse(this.graph.getVertex(id))) {
			const forced = Dataflow.targetsOf(this.graph, id, EdgeType.Reads).filter(p => this.idMap.get(this.idMap.get(p)?.info.parent ?? -1)?.info.parent === fn);
			return forced.some(p => Dataflow.argumentsBoundTo(this.graph, p).some(a => RNode.findEnclosing(a, this.idMap, n => n.info.id === call) !== undefined
				&& (this.assigns(a, name, BuiltInProcName.Assignment) || this.assigns(a, name, BuiltInProcName.SuperAssignment))));
		}
		const inner = this.callOf(statement);
		const callee = inner === undefined || depth >= MaxPromiseHandOn ? undefined : this.topLevelTarget(inner);
		if(inner === undefined || callee === undefined) {
			return false;
		}
		const statements = this.statementsOf(callee);
		const at = statements.findIndex(s => this.surelyWrites(s, name, callee, inner, depth + 1));
		const definition = this.graph.getVertex(callee) as DataflowGraphVertexFunctionDefinition;
		/* a return before the write may leave the callee without it */
		return at >= 0 && !definition.exitPoints.some(e => e.type === ExitPointType.Return && this.statementIndex(e.nodeId, statements) < at);
	}

	/** Whether the top-level closure `fn` surely replaces the global `name` before anything forces the promise `call` binds to its parameter `param`: every read of the parameter follows a statement surely writing `name`, or hands the promise on to a callee for which the same holds. */
	private writtenBeforeForced(fn: NodeId, param: NodeId, name: BrandedIdentifier, call: NodeId, depth = 0): boolean {
		const reads = Dataflow.sourcesOf(this.graph, param, EdgeType.Reads);
		const statements = this.statementsOf(fn);
		let firstWrite: number | undefined;
		return reads.length > 0 && reads.every(read => {
			const at = RNode.findEnclosing(read, this.idMap, RFunctionDefinition.is) === fn ? this.statementIndex(read, statements) : -1;
			if(at < 0) {
				return false;
			}
			firstWrite ??= statements.findIndex(s => this.surelyWrites(s, name, fn, call, depth));
			if(firstWrite >= 0 && firstWrite < at) {
				return true;
			}
			/* `g(a)`: the promise is handed on, and `g` decides when it is forced */
			const inner = this.callOf(statements[at]);
			const callee = inner === undefined || depth >= MaxPromiseHandOn ? undefined : this.topLevelTarget(inner);
			const argument = this.idMap.get(read)?.info.parent;
			const handed = argument === undefined ? undefined : this.idMap.get(argument);
			if(inner === undefined || callee === undefined || !RArgument.is(handed) || handed.info.parent !== inner) {
				return false;
			}
			const bound = [read, handed.info.id].flatMap(r => Dataflow.targetsOf(this.graph, r, EdgeType.DefinesOnCall));
			return bound.length === 1 && this.writtenBeforeForced(callee, bound[0], name, inner, depth + 1);
		});
	}

	/** Drops what a read in an argument of the top-level call `call` sees of the definitions the program made before the call, when the call replaces the name before it forces the promise. */
	settle(call: NodeId, argument: NodeId, read: NodeId, name: BrandedIdentifier): void {
		const fn = this.topLevelTarget(call);
		const statement = fn === undefined || !this.graph.isRoot(read) ? undefined : ProgramOrder.runsOnceAt(call, this.graph);
		if(fn === undefined || statement === undefined) {
			return;
		}
		const before = Dataflow.targetsOf(this.graph, read, EdgeType.Reads).filter(t => ProgramOrder.runsOnceAt(t, this.graph) !== undefined && ProgramOrder.offset(t, statement, this.graph) < 0);
		const params = before.length === 0 ? [] : Dataflow.targetsOf(this.graph, argument, EdgeType.DefinesOnCall);
		if(params.length !== 1 || !this.writtenBeforeForced(fn, params[0], name, call)) {
			return;
		}
		/* where a `<<-` writes depends on whether the name was bound before, so its writes read what the promise no longer does */
		const writes = Dataflow.sourcesOf(this.graph, call, EdgeType.SideEffectOnCall).filter(w => {
			const node = this.idMap.get(w);
			return RSymbol.is(node) && Identifier.getName(node.content) === name;
		});
		for(const def of before) {
			this.graph.removeEdgeType(read, def, EdgeType.Reads);
			for(const write of writes) {
				this.graph.addEdge(write, def, EdgeType.Reads);
			}
		}
	}

	/** Drops what a read in the default of `param` cannot see: the default is evaluated once, in the frame of `fn`, by the statement first forcing it, so it sees neither what later statements define, nor, once a statement before surely redefines the name, the parameter it names or what came before (`function(a, b = a) { a <- 10; b }`). */
	settleDefault(fn: NodeId, param: NodeId, read: NodeId, name: BrandedIdentifier): void {
		const seen = Dataflow.targetsOf(this.graph, read, EdgeType.Reads);
		if(seen.length < 2) {
			return;
		}
		const statements = this.statementsOf(fn);
		const reads = Dataflow.sourcesOf(this.graph, param, EdgeType.Reads);
		const at = (r: NodeId) => RNode.findEnclosing(r, this.idMap, RFunctionDefinition.is) === fn ? this.statementIndex(r, statements) : -1;
		/* the first statement that may force it, and the first that surely does */
		const mayForce = Math.min(...reads.map(at));
		const own = this.graph.getVertex(fn)?.cds ?? [];
		const surelyForces = Math.min(...reads.filter(r => ControlDependency.minus(this.graph.getVertex(r)?.cds ?? [], own).length === 0).map(at));
		if(mayForce < 0 || !Number.isFinite(mayForce)) {
			return;
		}
		const lastWrite = statements.findLastIndex((s, i) => i < mayForce && this.assigns(s.info.id, name, BuiltInProcName.Assignment));
		for(const before of seen) {
			const node = this.idMap.get(before);
			const parameter = node?.info.role === RoleInParent.ParameterName && this.idMap.get(node.info.parent ?? -1)?.info.parent === fn;
			const index = this.statementIndex(before, statements);
			if((parameter && lastWrite >= 0) || (index >= 0 && (index < lastWrite || index > surelyForces))) {
				this.graph.removeEdgeType(read, before, EdgeType.Reads);
			}
		}
	}
}

/** For a call of a package function flowR has no body for (not one of R's own packages, whose functions the built-in configuration states): `false` if it is none, else the arguments whose promises may be forced after the call returned. */
function keptPromisesOfPackageCall(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, ctx: FlowrAnalyzerContext): ReadonlySet<NodeId> | false {
	const info = call.name === undefined ? undefined : ctx.functionInfo(call.name);
	const pkg = info?.package ?? (call.name === undefined ? undefined : Identifier.getNamespace(call.name));
	if(pkg === undefined || isBaseRPackage(pkg)) {
		return false;
	}
	if(!handsBackCalledValue(graph, call.id)) {
		return new Set();
	}
	const layout = info?.sig === undefined ? undefined : FnSig.layout(info.sig);
	const args = call.args.filter(FunctionArgument.isNotEmpty);
	const slots = layout === undefined ? undefined : FnSig.slots(layout, args.map(FunctionArgument.getName));
	return new Set(args.filter((_, i) => {
		const props = layout === undefined || slots === undefined || slots[i] < 0 ? 0 : layout.props[slots[i]];
		return (props & (ArgProp.Forced | ArgProp.Lazy)) === 0;
	}).map(a => a.nodeId));
}

/** Whether the value of `call` may be called after it returned: it is a function, or it flows (through variables, returns, and reads) to where a call takes its function from, as `g` in `g <- f(); g()`. */
function handsBackCalledValue(graph: DataflowGraph, call: NodeId): boolean {
	if(Dataflow.targetsOf(graph, call, EdgeType.Returns).some(t => DfgVertex.isFunctionDefinition(graph.getVertex(t)))) {
		return true;
	}
	const seen = new Set<NodeId>([call]);
	const todo = [call];
	for(let id = todo.pop(); id !== undefined; id = todo.pop()) {
		for(const [source, edge] of graph.edgesTo(id)) {
			if(seen.has(source) || DfEdge.includesType(edge, EdgeType.Argument) || DfEdge.doesNotIncludeType(edge, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.Returns)) {
				continue;
			} else if(DfgVertex.isFunctionCall(graph.getVertex(source)) && DfEdge.includesType(edge, EdgeType.Reads)) {
				return true;
			}
			seen.add(source);
			todo.push(source);
		}
	}
	return false;
}

/** Whether the promise bound to a parameter may be forced after its call returned: its function does not surely force it, and a closure within the function reads it or it is handed on to a parameter whose promise may. */
function promiseOutlivesCall(graph: DataflowGraph, idMap: AstIdMap, forcing: (holder: NodeId, inner: NodeId) => Ternary): (parameter: NodeId) => boolean {
	const ownerOf = new Map<NodeId, NodeId>();
	for(const [id, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		for(const parameter of Dataflow.parametersOf(definition)) {
			ownerOf.set(parameter, id);
		}
	}
	const handedTo = new DefaultMap<NodeId, NodeId[]>(() => []);
	for(const parameter of ownerOf.keys()) {
		for(const argument of Dataflow.argumentsBoundTo(graph, parameter)) {
			for(const read of Dataflow.targetsOf(graph, argument, EdgeType.Reads)) {
				if(ownerOf.has(read)) {
					handedTo.get(read).push(parameter);
				}
			}
		}
	}
	const captured = (parameter: NodeId) => Dataflow.sourcesOf(graph, parameter, EdgeType.Reads)
		.some(read => RNode.findEnclosing(read, idMap, RFunctionDefinition.is) !== ownerOf.get(parameter));
	const open = (p: NodeId) => forcing(p, p) !== Ternary.Always;
	const outlives = new ReachSummaries<NodeId, boolean>(p => open(p) ? handedTo.get(p) : [], p => open(p) && captured(p), Monoid.any);
	return parameter => ownerOf.has(parameter) && outlives.of(parameter);
}

/** The definitions of a name that may be made after a call: those in its scope it does not surely run after, and every `<<-`. */
function definitionsAfter(graph: DataflowGraph, idMap: AstIdMap): (call: NodeId, name: BrandedIdentifier) => readonly NodeId[] {
	const byName = Dataflow.definitionsByName(graph);
	const superAssigned = new Set(graph.verticesOfType(VertexType.FunctionCall)
		.filter(([id]) => Dataflow.superAssigns(graph, id))
		.flatMap(([id]) => Dataflow.targetsOf(graph, id, EdgeType.Returns)));
	const scopeOf = memoize((id: NodeId) => graph.isRoot(id) ? undefined : RNode.strictlyEnclosingFunction(id, idMap));
	return (call, name) => {
		const scope = scopeOf(call);
		const statement = ProgramOrder.runsOnceAt(call, graph);
		return byName.get(name).filter(def => superAssigned.has(def)
			|| (scopeOf(def) === scope && (statement === undefined || ProgramOrder.offset(def, statement, graph) > 0)));
	};
}

/** Links every materialized package-export vertex back to the `library()`/`use()` call that loaded it, reading the loading call from the export binding's `definedAt` in the (final, authoritative) environment. */
export function linkMaterializedExportsToLoaders(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): void {
	/* the attached namespaces hold every export of every package, far more than the graph ever materializes, so the cheap direction is to ask the graph first: an export earns an edge only if it is a vertex or something points to it, called or read as a value (`g <- select`). */
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
	/* the loader targets are `library()` call ids, never export ids, so the edges added here never make a further export qualify -- the lazy checks this replaces could not have observed one either */
	for(const [id, loadedAt] of loaders) {
		/* an export only read as a value (`g <- select`) has no vertex yet, which a slice could not pass */
		attachExportVertex(graph, id, environment, ctx);
		graph.addEdge(id, loadedAt, EdgeType.Reads | EdgeType.Calls);
	}
}

/** The packages (see {@link EnvType}) attached directly within a function body, i.e. its own `library()` calls. */
function ownLibraryCalls(_id: NodeId, fdef: DataflowGraphVertexFunctionDefinition): { pack: BrandedNamespace, definedAt: NodeId }[] {
	const packages: { pack: BrandedNamespace, definedAt: NodeId }[] = [];
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

/** The non-built-in definitions a function body lets escape to an outer scope (e.g. a `<<-` super-assignment), as a callback for {@link computeCallGraphSummaries}. */
function escapedDefinitions(this: void, graph: DataflowGraph, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>): (id: NodeId, fdef: DataflowGraphVertexFunctionDefinition) => readonly NodeId[] {
	const perFrame = new Map<MemoryView, NodeId[]>();
	/* the function an exit hook runs in folds the hook's writes into its final environment in the order R runs the hooks */
	const hooks = new Set(graph.verticesOfType(VertexType.FunctionDefinition).flatMap(([, v]) => v.subflow.hooks.map(h => h.id)));
	return (id, fdef) => {
		const defs: NodeId[] = hidden.keys().filter(call => fdef.subflow.graph.has(call)).toArray();
		if(hooks.has(id)) {
			return defs;
		}
		for(const e of REnvironment.frames(fdef.subflow.environment.current.parent)) {
			let escaped = perFrame.get(e.memory);
			if(escaped === undefined) {
				escaped = [];
				perFrame.set(e.memory, escaped);
				/* an attached package binds nothing but its exports, which are built-ins, and a package frame holds thousands of entries, so this walks the others in place */
				for(const ds of e.memory instanceof Frame && e.memory.lazy() !== undefined ? [] : e.memory.values()) {
					for(const d of ds) {
						if(!NodeId.isBuiltIn(d.nodeId)) {
							escaped.push(d.nodeId);
						}
					}
				}
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
function propagateTransitiveDefinitions(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, summary: Relation<NodeId, NodeId>): void {
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

/** Attaches packages transitively loaded by top-level calls to `environment`. */
function propagateTransitivePackages(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): { environment: REnvironmentInformation, grew: boolean } {
	const summary = computeCallGraphSummaries(graph, ownLibraryCalls);
	/* package to its loading `library()` call and, unless a call reaching it surely runs, the cds of one that may */
	const reachable = new Map<BrandedNamespace, { definedAt: NodeId, cds: readonly ControlDependency[] | undefined }>();
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

type NamedDefinition = NamedInGraphIdentifierDefinition<BrandedIdentifier>;
type AmbientDefinition = NamedInGraphIdentifierDefinition<AmbientStateName>;

/** The ambient writes of body calls only linking resolved to a built-in (see {@link writesOfHiddenBuiltIn}), recording and linking their reads as well. */
function hiddenBuiltInWrites(graph: DataflowGraph, environment: REnvironmentInformation, drawing: boolean): Map<NodeId, AmbientDefinition[]> {
	const builtIns = REnvironment.findBuiltIn(environment.current);
	const writes = new Map<NodeId, AmbientDefinition[]>();
	const reads = new Map<NodeId, AmbientStateName[]>();
	const resolved: [NodeId, readonly IdentifierDefinition[]][] = [];
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(graph.isRoot(id) || !reachesBuiltInLate(vertex)) {
			continue;
		}
		const own = DfgVertex.hasOrigin(vertex, BuiltInProcName.Function) ? undefined : vertex.name;
		for(const target of Dataflow.targetsOf(graph, id, EdgeType.Calls)) {
			if(NodeId.isBuiltIn(target) && (own === undefined || NodeId.toBuiltIn(Identifier.getName(own)) !== target)) {
				const targets = Resolve.byNameAndType(NodeId.fromBuiltIn(target), { current: builtIns, level: 0 }, ReferenceType.Function) ?? [];
				resolved.push([id, targets]);
				const defs = targets.flatMap(d => writesOfHiddenBuiltIn(d, id, drawing));
				if(defs.length > 0) {
					writes.set(id, [...writes.get(id) ?? [], ...defs]);
				}
				const names = targets.flatMap(readsOfHiddenBuiltIn);
				if(names.length > 0) {
					reads.set(id, [...reads.get(id) ?? [], ...names]);
				}
			}
		}
	}
	for(const [id, targets] of resolved) {
		hiddenSideEffects(graph, environment, id, targets);
	}
	for(const id of new Set([...writes.keys(), ...reads.keys()])) {
		graph.recordAmbientAccess(id, { reads: reads.get(id), writes: writes.get(id)?.map(d => d.name) });
	}
	linkHiddenReads(graph, reads);
	return writes;
}

/** A hidden call reads the state where the functions running it are called. */
function linkHiddenReads(graph: DataflowGraph, reads: ReadonlyMap<NodeId, readonly AmbientStateName[]>): void {
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

/** Maps each definition escaping into the global frame to its full (name-carrying) definitions, one node may define several names (`options(digits = 3)`); a write from a function defined within another one may be caught by that function's frame instead. */
function escapedDefinitionMap(graph: DataflowGraph, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>): Map<NodeId, NamedDefinition[]> {
	const map = new Map<NodeId, NamedDefinition[]>(hidden.entries().map(([id, defs]) => [id, [...defs]]));
	const definitionsOf = new DefaultMap<NodeId, NamedDefinition[]>(() => [], map);
	const seen = new Set<MemoryView>();
	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const global = REnvironment.frames(vertex.subflow.environment.current.parent).filter(e => e.t === undefined).reduce<Environment | undefined>((_, e) => e, undefined);
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

/** Folds the `<<-` definitions that escape transitively from top-level calls into `environment`. */
function propagateTransitiveEscapedDefinitions(graph: DataflowGraph, environment: REnvironmentInformation, defined: Set<BrandedIdentifier>, hidden: ReadonlyMap<NodeId, readonly NamedDefinition[]>, summary: Relation<NodeId, NodeId>, open: readonly IdentifierReference[]): { environment: REnvironmentInformation, grew: boolean, names: Set<BrandedIdentifier> } {
	const defs = escapedDefinitionMap(graph, hidden);
	const names = new Set<BrandedIdentifier>();
	let byName: DefaultMap<BrandedIdentifier, NodeId[]> | undefined;
	const definitionsNamed = (name: BrandedIdentifier) => (byName ??= Dataflow.definitionsByName(graph)).get(name);
	let grew = false;
	for(const [id] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(!graph.isRoot(id)) {
			continue;
		}
		for(const target of Dataflow.calleeIdsOf(graph, id)) {
			for(const def of (summary.get(target) ?? []).values().flatMap(nodeId => defs.get(nodeId) ?? [])) {
				const nodeId = def.nodeId;
				names.add(def.name);
				/* a name may hold several definitions while a lookup answers with one, so asking the environment would call every shadowed one missing and define it again on every round; what this fixpoint has already folded in is what says whether there is anything left to add */
				const key = `${def.name}\u0000${String(nodeId)}`;
				if(defined.has(key)) {
					continue;
				}
				defined.add(key);
				if(Resolve.byNameAndType(def.name, environment, def.type)?.some(d => d.nodeId === nodeId)) {
					continue;
				}
				environment = REnvironment.define(def, false, environment);
				linkReadsAfter(graph, id, def, open, definitionsNamed, defs);
				grew = true;
			}
		}
	}
	return { environment, grew, names };
}

/** A read that may run after `call` and sees a definition the call may replace (or nothing, as with the `open` reads) may see `def` instead, as with a callee only the call binds: `g <- function(f) f(); x <- 1; g(function() x <<- 2); print(x)`, or `g(runif)`. */
function linkReadsAfter(graph: DataflowGraph, call: NodeId, def: NamedDefinition, open: readonly IdentifierReference[], definitionsNamed: (name: BrandedIdentifier) => readonly NodeId[], escaped: ReadonlyMap<NodeId, readonly NamedDefinition[]>): void {
	const before = graph.getVertex(call)?.environment;
	const visible = before === undefined ? definitionsNamed(def.name) : Resolve.byName(def.name, before)?.map(d => d.nodeId) ?? [];
	/* a write of the call that escapes under another name (`par` beside `plot` in the body) replaces nothing of this one */
	const sameName = (id: NodeId) => escaped.get(id)?.some(d => d.name === def.name) ?? true;
	const replaced = new Set([...visible, ...Dataflow.sourcesOf(graph, call, EdgeType.SideEffectOnCall).filter(sameName)]);
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
export function reResolveOpenReferences(this: void, graph: DataflowGraph, environment: REnvironmentInformation, references: readonly IdentifierReference[], escapedNames: ReadonlySet<BrandedIdentifier>): void {
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

/** Which of the {@link AmbientAccess} to take along when asking {@link ambientAccessOf}. */
export interface AmbientAccessOptions {
	/** whether to add what the functions called by the code access as well, defaults to true */
	readonly includeCallees?: boolean
	/** What {@link ambientAccessOfFunctions} answered for the same graph, to reuse when asking for several scopes. */
	readonly functions?:      ReadonlyMap<NodeId, AmbientAccess>
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

/** What the call `id` itself accesses, without the functions it calls. */
function accessOfCall(graph: DataflowGraph, id: NodeId, environment: REnvironmentInformation | undefined): AmbientAccess {
	const recorded = graph.ambientAccessOf(id) ?? AmbientAccess.empty;
	return drawsOn(graph, id, environment) ? { ...recorded, draws: new Set([id]) } : recorded;
}

/**
 * What each function accesses when it is called: the pseudo variables it reads and changes (see {@link AmbientStateName}), the global variables it binds and the drawing calls it makes, together with what the functions it calls access.
 * @useInstead {@link Dataflow.sideEffects.ambientAccessOfFunctions}
 */
export function ambientAccessOfFunctions(this: void, from: AmbientSource): Map<NodeId, AmbientAccess> {
	const [graph, environment] = graphOf(from);
	const names = escapedDefinitionMap(graph, new Map());
	const escaped = escapedDefinitions(graph, new Map());
	return foldCallGraph(graph, AmbientAccess.monoid, (id, fdef) => Monoid.fold(AmbientAccess.monoid, [
		...Dataflow.callsIn(fdef, graph).map(([call]) => accessOfCall(graph, call, environment)),
		{
			...AmbientAccess.empty,
			/* removing a global is a write of it, as far as what a function binds goes */
			variables: Relation.fromPairs(escaped(id, fdef).flatMap(def => names.get(def) ?? []).filter(({ name }) => !AmbientStateName.is(name)).map(({ name, nodeId }) => [removedNameOf(name), nodeId]))
		}
	]));
}

/** Adds the ids of every file a `source` call among `ids` runs, transitively, found by where the call continues with another file. */
function addSourcedFiles(graph: DataflowGraph, ids: Set<NodeId>): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const todo = [...ids];
	for(let id = todo.pop(); id !== undefined; id = todo.pop()) {
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

/** The code to ask {@link ambientAccessOf} for: a whole project (all files), a node with all the code it spans (a file root, a block, a statement), the id of such a node, or exactly the given ids. */
export type AmbientScope = RProject<ParentInformation> | RNode<ParentInformation> | NodeId | Iterable<NodeId>;

function idsOfScope(graph: DataflowGraph, scope: AmbientScope): Set<NodeId> {
	if(typeof scope === 'string' || typeof scope === 'number') {
		const node = graph.idMap?.get(scope);
		return node === undefined ? new Set([scope]) : RNode.collectAllIds(node);
	} else if(RProject.is<ParentInformation>(scope)) {
		return RProject.collectAllIds(scope);
	} else if('type' in scope) {
		return RNode.collectAllIds(scope);
	}
	return new Set(scope);
}

/**
 * What running the given code reads and writes of the global state, see {@link AmbientAccess}: the calls in `scope` and, unless turned off, what the functions they call access.
 * @useInstead {@link Dataflow.sideEffects.ambientAccess}
 */
export function ambientAccessOf(this: void, from: AmbientSource, scope: AmbientScope, opts?: AmbientAccessOptions): AmbientAccess {
	const [graph, environment] = graphOf(from);
	const ids = idsOfScope(graph, scope);
	addSourcedFiles(graph, ids);
	/* the bodies of nested definitions, exit hooks among them, are no part of the scope (`collectAllIds` misses the hooks) */
	const bodies = new Set<NodeId>();
	const definitions = [...ids];
	for(let id = definitions.pop(); id !== undefined; id = definitions.pop()) {
		const vertex = graph.getVertex(id);
		if(DfgVertex.isFunctionDefinition(vertex)) {
			for(const inner of vertex.subflow.graph) {
				if(!bodies.has(inner)) {
					bodies.add(inner);
					definitions.push(inner);
				}
			}
		}
	}
	const accesses: AmbientAccess[] = [];
	const callees = new Set<NodeId>();
	for(const id of ids) {
		if(bodies.has(id) || !DfgVertex.isFunctionCall(graph.getVertex(id))) {
			continue;
		}
		accesses.push(accessOfCall(graph, id, environment));
		if(opts?.includeCallees !== false) {
			for(const callee of Dataflow.calleeIdsOf(graph, id)) {
				callees.add(callee);
			}
		}
		/* what the call evaluates that the code does not write (`eval(parse(text = s))`, `eval(call("f"))`, `do.call(name)`) is part of it */
		for(const made of Dataflow.targetsOf(graph, id, EdgeType.Calls | EdgeType.Returns | EdgeType.Argument)) {
			if(!NodeId.isWritten(made) && !NodeId.isBuiltIn(made)) {
				const node = graph.idMap?.get(made);
				(node === undefined ? [made] : RNode.collectAllIds(node)).forEach(inner => ids.add(inner));
			}
		}
	}
	if(callees.size > 0) {
		const functions = opts?.functions ?? ambientAccessOfFunctions(from);
		for(const callee of callees) {
			const access = functions.get(callee);
			if(access !== undefined) {
				accesses.push(access);
			}
		}
	}
	return Monoid.fold(AmbientAccess.monoid, accesses);
}

/**
 * Propagates every function's escaped side effects (attached packages and `<<-` definitions) to its transitive callers.
 * @useInstead {@link Dataflow.sideEffects.propagateTransitive}
 */
export function propagateTransitiveSideEffects(this: void, graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, defined: Set<BrandedIdentifier> = new Set(), open: readonly IdentifierReference[] = []): { environment: REnvironmentInformation, grew: boolean, escapedNames: Set<BrandedIdentifier> } {
	const hidden = hiddenBuiltInWrites(graph, environment, drawingWritesDevice(ctx.config));
	/* both passes ask what escapes each function, and neither changes a body or a call target in between */
	const escapes = computeCallGraphSummaries(graph, escapedDefinitions(graph, hidden));
	propagateTransitiveDefinitions(graph, environment, ctx, escapes);
	const packages = propagateTransitivePackages(graph, environment, ctx);
	const escaped = propagateTransitiveEscapedDefinitions(graph, packages.environment, defined, hidden, escapes, open);
	return { environment: escaped.environment, grew: packages.grew || escaped.grew, escapedNames: escaped.names };
}
