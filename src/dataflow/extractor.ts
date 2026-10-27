import type { DataflowInformation } from './info';
import { appliedArguments } from './graph/applied-arguments';
import { FunctionSemantics } from './fn/function-semantics';
import { type DataflowProcessorInformation, type DataflowProcessors, processDataflowFor } from './processor';
import { processUninterestingLeaf } from './internal/process/process-uninteresting-leaf';
import { processSymbol } from './internal/process/process-symbol';
import { processFunctionCall } from './internal/process/functions/call/default-call-handling';
import { processFunctionParameter } from './internal/process/functions/process-parameter';
import { processFunctionArgument } from './internal/process/functions/process-argument';
import { processAsNamedCall, processChainedCall } from './internal/process/process-named-call';
import { processValue } from './internal/process/process-value';
import { processNamedCall } from './internal/process/functions/call/named-call-handling';
import { wrapArgumentsUnnamed } from './internal/process/functions/call/argument/make-argument';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { standaloneSourceFile } from './internal/process/functions/call/built-in/built-in-source';
import { attachProject } from './internal/process/functions/call/built-in/built-in-library';
import { type DataflowGraph, FunctionArgument, UnknownSideEffect } from './graph/graph';
import { handleUnknownSideEffect } from './graph/unknown-side-effect';
import { ControlFlowGraph } from '../control-flow/control-flow-graph';
import { DfEdge, EdgeType } from './graph/edge';
import { identifyLinkToLastCallRelationSync } from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import { updateNestedFunctionCalls } from './internal/process/functions/call/built-in/built-in-function-definition';
import { reResolveOpenReferences, linkMaterializedExportsToLoaders } from './internal/process/functions/call/built-in/transitive-side-effects';
import { orderRaisingBodies } from './internal/process/functions/call/built-in/built-in-try-catch';
import { getAllLinkedFunctionDefinitions, separateClosureInstances } from './internal/linker';
import type { REnvironmentInformation } from './environments/environment';
import { REnvironment } from './environments/environment';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { FlowrFile } from '../project/context/flowr-file';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from './graph/vertex';
import { VertexType, DfgVertex } from './graph/vertex';
import type { LinkToLastCall } from '../queries/catalog/call-context-query/call-context-query-format';
import { hasEnvState, Identifier, type IdentifierReference } from './environments/identifier';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { SourceRange } from '../util/range';
import { dataflowLogger } from './logger';
import { type DataflowBudgetTracker, GasFeatureKey, GasLevel, GasWikiRef, withDataflowBudget } from '../gas';
import { DefaultTransitiveSideEffectRounds } from '../config';
import { Dataflow } from './graph/df-helper';
import { mayForce } from './internal/process/functions/call/built-in/built-in-ambient-state';
import { AmbientStateName } from './environments/ambient-state-name';
import { UnnamedFunctionCallPrefix } from './internal/process/functions/call/unnamed-call-handling';
import { BuiltInProcName } from './environments/built-in-proc-name';
import { partitionArray, uniqueArray } from '../util/collections/arrays';
import { DefaultMap, memoize } from '../util/collections/defaultmap';
import { MatchArgs } from './graph/match-args';
import { ArgProp, SemanticCallTag } from './environments/built-in-props';
import type { ArgProps, BuiltInFnInfo } from './environments/built-in-props';
import type { BuiltInIndex } from './environments/query-fn-props';
import { callFnProps, queryFnProps } from './environments/query-fn-props';
import { Resolve } from './environments/resolve-helper';
import { reachableTo } from '../control-flow/happens-before';
import { guardNesting } from '../util/assert';
import type { CallContext } from './eval/resolve/alias-tracking';
import { NodeValue } from './eval/resolve/node-value';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';

/**
 * The best friend of {@link produceDataFlowGraph} and {@link processDataflowFor}.
 * Maps every {@link RType} in the normalized AST to a processor.
 */
export const processors: DataflowProcessors<ParentInformation> = {
	[RType.Number]:             processValue,
	[RType.String]:             processValue,
	[RType.Logical]:            processValue,
	[RType.Comment]:            processUninterestingLeaf,
	[RType.LineDirective]:      processUninterestingLeaf,
	[RType.Symbol]:             processSymbol,
	[RType.Access]:             (n, d) => processAsNamedCall(n, d, n.operator, [n.accessed, ...n.access]),
	[RType.BinaryOp]:           processChainedCall,
	[RType.Pipe]:               processChainedCall,
	[RType.UnaryOp]:            (n, d) => processAsNamedCall(n, d, n.operator, [n.operand]),
	[RType.ForLoop]:            (n, d) => processAsNamedCall(n, d, n.lexeme, [n.variable, n.vector, n.body]),
	[RType.WhileLoop]:          (n, d) => processAsNamedCall(n, d, n.lexeme, [n.condition, n.body]),
	[RType.RepeatLoop]:         (n, d) => processAsNamedCall(n, d, n.lexeme, [n.body]),
	[RType.IfThenElse]:         (n, d) => processAsNamedCall(n, d, n.lexeme, [n.condition, n.then, n.otherwise]),
	[RType.Break]:              (n, d) => processAsNamedCall(n, d, n.lexeme, []),
	[RType.Next]:               (n, d) => processAsNamedCall(n, d, n.lexeme, []),
	[RType.FunctionCall]:       processFunctionCall,
	[RType.FunctionDefinition]: (n, d) => processAsNamedCall(n, d, n.lexeme, [...n.parameters, n.body]),
	[RType.Parameter]:          processFunctionParameter,
	[RType.Argument]:           processFunctionArgument,
	[RType.ExpressionList]:     ({ grouping, info, children, location }, d) => {
		const groupStart = grouping?.[0];
		return processNamedCall({
			type:     RType.Symbol,
			info:     info,
			content:  groupStart?.content ?? '{',
			lexeme:   groupStart?.lexeme ?? '{',
			location: location ?? SourceRange.invalid(),
			ns:       groupStart?.content ? undefined : 'base'
		}, wrapArgumentsUnnamed(children, d.completeAst.idMap), info.id, d);
	}
};


function linkEnvironmentArgumentsWrittenByCallee(graph: DataflowGraph, environment: REnvironmentInformation): void {
	if(!tracksAnyEnvironment(environment)) {
		return;
	}
	for(const [, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const parameters = new Set(Dataflow.parametersOf(definition));
		if(parameters.size === 0) {
			continue;
		}
		const writesByParameter = new DefaultMap<NodeId, NodeId[]>(() => []);
		writesOfParameters(graph, definition, parameters, writesByParameter, environment);
		for(const [parameter, writes] of writesByParameter.entries()) {
			for(const argument of Dataflow.argumentsBoundTo(graph, parameter)) {
				if(!holdsEnvironment(graph, argument, environment)) {
					continue;
				}
				for(const call of Dataflow.sourcesOf(graph, argument, EdgeType.Argument).filter(c => DfgVertex.isFunctionCall(graph.getVertex(c)))) {
					handleUnknownSideEffect(graph, environment, call);
					for(const write of writes) {
						graph.addEdge(call, write, EdgeType.Reads);
					}
				}
			}
		}
	}
}

function tracksAnyEnvironment(environment: REnvironmentInformation): boolean {
	for(const e of REnvironment.frames(environment.current)) {
		if(e.memory.values().some(defs => defs.some(hasEnvState))) {
			return true;
		}
	}
	return false;
}

/** Collects, per parameter of `definition`, the replacements (`x$f <- v`) and the side-effecting calls in its body that write into it. */
function writesOfParameters(graph: DataflowGraph, definition: DataflowGraphVertexFunctionDefinition, parameters: ReadonlySet<NodeId>, written: DefaultMap<NodeId, NodeId[]>, environment: REnvironmentInformation): void {
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		if(DfgVertex.isVariableDefinition(vertex) && vertex.par) {
			const replacements = Dataflow.targetsOf(graph, node, EdgeType.DefinedBy).filter(t => DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.Replacement));
			for(const parameter of Dataflow.targetsOf(graph, node, EdgeType.Reads).filter(t => parameters.has(t))) {
				written.get(parameter).push(...replacements);
			}
		} else if(DfgVertex.isFunctionCall(vertex) && graph.unknownSideEffects.has(NodeId.normalize(node))) {
			for(const target of argsWithProp(vertex, callFnProps(node, { graph, environment }), ArgProp.Written)) {
				for(const reached of definitionsReachedBy(target, graph)) {
					if(parameters.has(reached)) {
						written.get(reached).push(node);
					}
				}
			}
		}
	}
}

function holdsEnvironment(graph: DataflowGraph, argument: NodeId, environment: REnvironmentInformation): boolean {
	const node = graph.idMap?.get(argument);
	return RSymbol.is(node) && (Resolve.byName(node.content, environment)?.some(hasEnvState) ?? false);
}

function openReadsOfCalledFunctions(graph: DataflowGraph): IdentifierReference[] {
	const reads = new Map<NodeId, IdentifierReference>();
	for(const [id, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		if(Dataflow.sourcesOf(graph, id, EdgeType.Calls).length > 0) {
			for(const read of definition.subflow.in) {
				if(read.name !== undefined && !AmbientStateName.is(read.name) && !Identifier.getName(read.name).startsWith(UnnamedFunctionCallPrefix)) {
					reads.set(read.nodeId, read);
				}
			}
		}
	}
	return [...reads.values()];
}

/** An active binding (`makeActiveBinding`) runs its function on every assignment to and read of the name, so each becomes a call of it. */
function callActiveBindings(graph: DataflowGraph): void {
	/* the definitions that call something are the bindings, and most scripts have none, so nothing else is walked then */
	const active = new Set<NodeId>();
	const bindings = new Map<NodeId, NodeId[]>();
	for(const [id] of graph.verticesOfType(VertexType.VariableDefinition)) {
		const called = Dataflow.targetsOf(graph, id, EdgeType.Calls);
		if(called.length > 0) {
			active.add(id);
			const fns = called.filter(t => DfgVertex.isFunctionDefinition(graph.getVertex(t)));
			if(fns.length > 0) {
				bindings.set(id, fns);
			}
		}
	}
	if(active.size === 0) {
		return;
	}
	for(const [, ids] of bindings.size === 0 ? [] : Dataflow.definitionsByName(graph).entries()) {
		const fns = ids.flatMap(id => bindings.get(id) ?? []);
		for(const id of fns.length === 0 ? [] : ids.filter(id => !bindings.has(id))) {
			for(const assignment of Dataflow.sourcesOf(graph, id, EdgeType.Returns).filter(a => DfgVertex.isFunctionCall(graph.getVertex(a)))) {
				active.add(id);
				for(const fn of fns) {
					graph.addEdge(assignment, fn, EdgeType.Calls);
					graph.addEdge(id, fn, EdgeType.Calls);
				}
			}
		}
	}
	for(const id of graph.vertexIdsOfType(VertexType.Use)) {
		const node = graph.idMap?.get(id);
		if(RSymbol.is(node) && Dataflow.targetsOf(graph, id, EdgeType.Reads).some(def => active.has(def))) {
			graph.updateToFunctionCall({ tag: VertexType.FunctionCall, id, name: node.content, args: [], environment: undefined, onlyBuiltin: false, cds: graph.getVertex(id)?.cds, origin: [BuiltInProcName.Function] });
		}
	}
}

/** A call of what a closure returned that we could not link (`h2 <- h()` with `h` returning `sys.function()`) may run anything. */
function markCallsOfUnknownValues(graph: DataflowGraph, environment: REnvironmentInformation): void {
	const fromClosure = (def: NodeId) => DfgVertex.isVariableDefinition(graph.getVertex(def))
		&& Dataflow.targetsOf(graph, def, EdgeType.DefinedBy).some(c => Dataflow.calleeIdsOf(graph, c).length > 0);
	for(const [id, call] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(!call.onlyBuiltin && Dataflow.targetsOf(graph, id, EdgeType.Calls).length === 0 && Dataflow.targetsOf(graph, id, EdgeType.Reads).some(fromClosure)) {
			handleUnknownSideEffect(graph, environment, id);
		}
	}
}

/** `environment()` hands out the function's frame by reference, so the call reads every definition of the frame, a closure's `<<-` included. */
function readFramesThroughEnvironment(graph: DataflowGraph): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const environmentCall = NodeId.toBuiltIn('environment');
	const callsEnvironment = (id: NodeId) => Dataflow.hasEdge(graph, id, environmentCall, EdgeType.Calls);
	/* `environment(fn)` hands out the frame `fn` was created in */
	const ofClosures = new DefaultMap<NodeId, NodeId[]>(() => []);
	for(const [id, call] of graph.verticesOfType(VertexType.FunctionCall)) {
		const fn = call.args.length === 1 && callsEnvironment(id) ? FunctionArgument.getReference(call.args[0]) : undefined;
		for(const closure of fn === undefined ? [] : getAllLinkedFunctionDefinitions(new Set([fn]), graph)[0]) {
			const creator = RNode.strictlyEnclosingFunction(closure.id, idMap);
			if(creator !== undefined) {
				ofClosures.get(creator).push(id);
			}
		}
	}
	for(const [, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const frameCalls = ofClosures.get(definition.id);
		if(frameCalls.length === 0 && !definition.subflow.graph.values().some(callsEnvironment)) {
			continue;
		}
		/* the nested functions' bodies, too, where a closure may write the frame */
		const within = [...definition.subflow.graph];
		for(const id of within) {
			const vertex = graph.getVertex(id);
			if(DfgVertex.isFunctionDefinition(vertex) && vertex.id !== definition.id) {
				within.push(...vertex.subflow.graph);
			}
		}
		const definitions: { id: NodeId, own: boolean, name: string | undefined }[] = [];
		for(const id of new Set(within)) {
			const vertex = graph.getVertex(id);
			const own = RNode.findEnclosing(id, idMap, RFunctionDefinition.is) === definition.id;
			if(own && DfgVertex.isFunctionCall(vertex) && vertex.args.length === 0 && callsEnvironment(id)) {
				frameCalls.push(id);
			} else if(DfgVertex.isVariableDefinition(vertex) && !(id in definition.params)) {
				/* a parameter is what the call binds, which reflecting on the frame already accounts for */
				definitions.push({ id, own, name: NodeId.recoverName(id, idMap) });
			}
		}
		const local = new Set(definitions.filter(d => d.own && d.name !== undefined).map(d => d.name));
		/* a nested definition writes this frame only by `<<-` to a name it binds */
		const bySuperAssignment = (id: NodeId) => DfgVertex.hasOrigin(graph.getVertex(idMap.get(id)?.info.parent ?? ''), BuiltInProcName.SuperAssignment);
		for(const d of definitions.filter(d => local.has(d.name ?? '') && (d.own || bySuperAssignment(d.id)))) {
			for(const call of frameCalls) {
				graph.addEdge(call, d.id, EdgeType.Reads);
			}
		}
	}
}

function argsWithProp(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined, prop: ArgProps): NodeId[] {
	return info?.sig === undefined ? [] : MatchArgs.findWithProps(vertex.args, info.sig, prop);
}

function definitionsReachedBy(node: NodeId, graph: DataflowGraph): ReadonlySet<NodeId> {
	return Dataflow.reachable(graph, node, {
		follow: EdgeType.Reads,
		stopAt: id => DfgVertex.isVariableDefinition(graph.getVertex(id))
	});
}

function fileCallNames(index: BuiltInIndex): ReadonlySet<string> {
	return new Set(index.with(SemanticCallTag.File).map(Identifier.getName));
}

function linkResourceReadersToWriters(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): void {
	const readers: { id: NodeId, resource: NodeId }[] = [];
	const writers: { id: NodeId, resource: NodeId }[] = [];
	const stated = new Map<string, (BuiltInFnInfo & { name: Identifier }) | undefined>();
	const candidates = ctx.env.deriveFromIndex(fileCallNames);
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(vertex.name !== undefined && !candidates.has(Identifier.getName(vertex.name))) {
			continue;
		}
		const name = Dataflow.qualify(id, graph, false) ?? vertex.name;
		const key = vertex.environment === undefined && name !== undefined ?
			`${vertex.onlyBuiltin ? 1 : 0}${Identifier.toString(name)}` : undefined;
		let info: (BuiltInFnInfo & { name: Identifier }) | undefined;
		if(key !== undefined && stated.has(key)) {
			info = stated.get(key);
		} else {
			info = callFnProps(id, { graph, environment });
			if(key !== undefined) {
				stated.set(key, info);
			}
		}
		const reads = FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.File, SemanticCallTag.Reads]);
		const writes = FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.File, SemanticCallTag.Writes]);
		if(!reads && !writes) {
			continue;
		}
		const resource = argsWithProp(appliedArguments(graph, vertex), info, ArgProp.Resource)[0];
		/* writing to the console names no file, and neither does a reader we cannot pin down */
		if(resource !== undefined) {
			(reads ? readers : writers).push({ id, resource });
		}
	}
	if(readers.length === 0 || writers.length === 0) {
		return;
	}
	const reachedBy = memoize((id: NodeId) => definitionsReachedBy(id, graph));
	const where = { graph, idMap: graph.idMap, resolve: ctx.config.solver.variables, ctx, environment };
	const pathOf = memoize((id: NodeId) => Resolve.toSingleString(id, where));
	const sameResource = (a: NodeId, b: NodeId): boolean => {
		if(a === b || !reachedBy(b).isDisjointFrom(reachedBy(a))) {
			return true;
		}
		/* a path we cannot resolve may name the other one */
		const path = pathOf(a);
		const other = pathOf(b);
		return path === undefined || other === undefined || path === other;
	};
	/* each added edge clears the graph's cached call names, but none of these edges changes what a call targets */
	const prints = memoize((id: NodeId) => FunctionSemantics.call.props.hasAll(callFnProps(id, { graph, environment }), [SemanticCallTag.Prints]));
	let cfg: ControlFlowGraph | undefined;
	for(const reader of readers) {
		let before: ReadonlySet<NodeId> | undefined;
		for(const writer of writers) {
			if(reader.id === writer.id || !sameResource(reader.resource, writer.resource)) {
				continue;
			}
			before ??= reachableTo(cfg ??= new ControlFlowGraph(graph), [reader.id]);
			if(before.has(writer.id)) {
				graph.addEdge(reader.id, writer.id, EdgeType.Reads);
				/* whatever prints into a diverting writer (`print` after `sink(file)`) writes to the resource as well */
				for(const id of Dataflow.sourcesOf(graph, writer.id, EdgeType.Reads).filter(prints)) {
					graph.addEdge(reader.id, id, EdgeType.Reads);
				}
			}
		}
	}
}

/** The paths the {@link ArgProp.Resource} arguments of the file accessing call `id` name, `undefined` unless every one resolves to strings. */
function pathsOf(id: NodeId, graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, callContext?: CallContext): ReadonlySet<string> | undefined {
	const vertex = graph.getVertex(id);
	if(!DfgVertex.isFunctionCall(vertex)) {
		return undefined;
	}
	const resources = argsWithProp(appliedArguments(graph, vertex), callFnProps(id, { graph, environment }), ArgProp.Resource);
	const paths = new Set<string>();
	for(const resource of resources) {
		const strings = NodeValue.stringsOf(RArgument.valueOf(graph.idMap?.get(resource)) ?? resource, Resolve.info(graph, ctx), { callContext });
		if(strings === undefined || strings.length === 0) {
			return undefined;
		}
		strings.forEach(p => paths.add(p));
	}
	return resources.length === 0 ? undefined : paths;
}

/** One level of calls running a file write in a function body: the calls of the function holding `at`, each with what it writes. */
interface FileWriteLevel {
	readonly at:         NodeId
	readonly definition: NodeId
	readonly calls:      readonly { readonly call: NodeId, readonly paths: ReadonlySet<string> | undefined }[]
}

/**
 * The levels of calls that run the file write `writer`: the calls of the function holding it, then the calls of the
 * function holding such a call, and so on. Each call resolves the file for the calls leading to it ({@link CallContext}).
 * `undefined` unless the levels account for every call the write has an effect on (a recursive function, a call we
 * do not see through), as only then can the write leave it to the calls to tell which of them run it.
 */
function fileWriteLevels(writer: NodeId, graph: DataflowGraph, idMap: AstIdMap, paths: (callContext: CallContext) => ReadonlySet<string> | undefined): FileWriteLevel[] | undefined {
	const affected = new Set(Dataflow.targetsOf(graph, writer, EdgeType.SideEffectOnCall));
	const first = RNode.findEnclosing(writer, idMap, RFunctionDefinition.is);
	if(first === undefined || affected.size === 0) {
		return undefined;
	}
	const levels: FileWriteLevel[] = [];
	const covered = new Set<NodeId>();
	const queue: { at: NodeId, definition: NodeId, context: CallContext }[] = [{ at: writer, definition: first, context: new Map() }];
	for(let item = queue.shift(); item !== undefined; item = queue.shift()) {
		const { at, definition, context } = item;
		const calls = [...affected].filter(c => Dataflow.targetsOf(graph, c, EdgeType.Calls).includes(definition));
		if(calls.length === 0 || context.has(definition)) {
			return undefined;
		}
		levels.push({ at, definition, calls: calls.map(call => {
			covered.add(call);
			const within = new Map(context).set(definition, call);
			const outer = RNode.strictlyEnclosingFunction(call, idMap);
			if(outer !== undefined) {
				queue.push({ at: call, definition: outer, context: within });
			}
			return { call, paths: paths(within) };
		}) });
	}
	return covered.size === affected.size ? levels : undefined;
}

/**
 * A file written within a function is written at each of its calls, so whatever reads it reads the write in the body,
 * which in turn depends on every call ({@link EdgeType.SideEffectOnCall}). Where the calls name their files, as
 * `save <- function(n) writeLines("x", n)` does for `save("a.txt")` and `save("b.txt")`, a read reads the calls writing
 * the file it reads as well, so the write no longer needs to depend on all of them: a read of `a.txt` needs `save("a.txt")`
 * only. Through a function calling `save` in turn, the read reads the call within it and the calls of that function.
 */
function separateFileWritesPerCall(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): void {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return;
	}
	const fileAccess = memoize((id: NodeId) => {
		const info = callFnProps(id, { graph, environment });
		return FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.File, SemanticCallTag.Writes]) ? 'write'
			: FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.File, SemanticCallTag.Reads]) ? 'read' : undefined;
	});
	const readPaths = memoize((id: NodeId) => fileAccess(id) === 'read' ? pathsOf(id, graph, environment, ctx) : undefined);
	/* writing to the console (`cat(x)`) names no file, and has no call to tell apart */
	const namesFile = (id: NodeId) => {
		const vertex = graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		return argsWithProp(appliedArguments(graph, vertex), callFnProps(id, { graph, environment }), ArgProp.Resource).length > 0;
	};
	const writers = [...graph.verticesOfType(VertexType.FunctionCall)].map(([id]) => id)
		.filter(id => graph.edgesFrom(id).values().some(e => DfEdge.includesType(e, EdgeType.SideEffectOnCall)) && !graph.unknownSideEffects.has(id) && fileAccess(id) === 'write' && namesFile(id));
	const separated = new Set<NodeId>();
	for(const writer of writers) {
		const levels = fileWriteLevels(writer, graph, idMap, callContext => pathsOf(writer, graph, environment, ctx, callContext));
		if(levels !== undefined) {
			separated.add(writer);
		}
		for(const { at, definition, calls } of levels ?? []) {
			const body = (graph.getVertex(definition) as DataflowGraphVertexFunctionDefinition).subflow.graph;
			/* what holds the definition (`(function(p) ...)`) is no reader of what its body writes */
			const holders = new Set([...RNode.iterateParents(idMap.get(at), idMap)].map(n => n.info.id));
			const readers = Dataflow.sourcesOf(graph, at, EdgeType.Reads).filter(r => !body.has(r) && !holders.has(r) && !calls.some(c => c.call === r));
			for(const { call, paths } of calls) {
				for(const reader of readers) {
					const read = readPaths(reader);
					if(read === undefined || paths === undefined || !read.isDisjointFrom(paths)) {
						graph.addEdge(reader, call, EdgeType.Reads);
					}
				}
			}
		}
	}
	graph.fileWritesPerCall = separated;
}

/** A variable read linked to a call diverting the output (`sink(con)`, see `AmbientStateName.textConnection`) also reads what that call diverts. */
function linkReadsOfDivertedOutput(graph: DataflowGraph, environment: REnvironmentInformation): void {
	if(!mayForce(environment)) {
		return;
	}
	const printsOf = memoize((id: NodeId) => FunctionSemantics.call.props.hasAll(callFnProps(id, { graph, environment }), [SemanticCallTag.Prints]));
	const printingCall = (writer: NodeId) => DfgVertex.isFunctionCall(graph.getVertex(writer)) && printsOf(writer);
	const writersOf = memoize((target: NodeId) => Dataflow.sourcesOf(graph, target, EdgeType.Reads).filter(printingCall));
	for(const [id] of graph.verticesOfType(VertexType.Use)) {
		for(const target of Dataflow.targetsOf(graph, id, EdgeType.Reads)) {
			const diverting = graph.getVertex(target);
			if(!DfgVertex.isFunctionCall(diverting) || diverting.args.length === 0) {
				continue;
			}
			for(const writer of writersOf(target)) {
				if(writer !== id) {
					graph.addEdge(id, writer, EdgeType.Reads);
				}
			}
		}
	}
}

function resolveLinkToSideEffects(graph: DataflowGraph, ctx: FlowrAnalyzerContext): void {
	const gasLevel = ctx.gas.checkGas(GasFeatureKey.SideEffectLinking);
	if(gasLevel >= GasLevel.Critical) {
		dataflowLogger.warn('Skipping side-effect link resolution due to resource pressure (gas: critical). See ' + GasWikiRef);
		return;
	} else if(gasLevel >= GasLevel.Problematic) {
		dataflowLogger.warn('Approaching resource limits during side-effect link resolution (gas: problematic). See ' + GasWikiRef);
	}
	let cf: ControlFlowGraph | undefined;
	let knownCalls: Map<NodeId, Required<DataflowGraphVertexFunctionCall>> | undefined;
	let allCallNames: string[] = [];
	const killedRegexes = new Set<string>();
	const handled = new Set<NodeId>();
	for(const s of graph.unknownSideEffects) {
		if(!UnknownSideEffect.isLinked(s)) {
			continue;
		}
		if(cf === undefined) {
			/* the control flow is already in the graph, so this only projects it into the shape the walk expects */
			cf = new ControlFlowGraph(graph);
			if(graph.unknownSideEffects.size > 20) {
				knownCalls = new Map(graph.verticesOfType(VertexType.FunctionCall) as MapIterator<[NodeId, Required<DataflowGraphVertexFunctionCall>]>);
				allCallNames = uniqueArray(knownCalls.values().map(c => Identifier.toString(c.name)));
			}
		} else if(handled.has(s.id)) {
			continue;
		}
		handled.add(s.id);
		const regexKey = s.linkTo.callName.source + '//' + s.linkTo.callName.flags;
		if(killedRegexes.has(regexKey)) {
			continue;
		} else if(allCallNames.length > 0 && !allCallNames.some(name => s.linkTo.callName.test(name))) {
			/* we know no call matches the regex */
			killedRegexes.add(regexKey);
			continue;
		}
		/* this has to change whenever we add a new link to relations because we currently offer no abstraction for the type */
		const potentials = identifyLinkToLastCallRelationSync(s.id, cf, graph, s.linkTo as LinkToLastCall<RegExp>, knownCalls);
		for(const pot of potentials) {
			graph.addEdge(s.id, pot, EdgeType.Reads);
		}
		if(potentials.length > 0) {
			graph.unknownSideEffects.delete(s);
		}
	}
}

/**
 * This is the main function to produce the dataflow graph from a given request and normalized AST.
 * Note, that this requires knowledge of the active parser in case the dataflow analysis uncovers other files that have to be parsed and integrated into the analysis
 * (e.g., in the event of a `source` call).
 * For the actual, canonical fold entry point, see {@link processDataflowFor}.
 */
export function produceDataFlowGraph<OtherInfo>(
	parser:      Parser<KnownParserType>,
	completeAst: NormalizedAst<OtherInfo & ParentInformation>,
	ctx:         FlowrAnalyzerContext,
	budget:      DataflowBudgetTracker | undefined = ctx.gas.budget(GasFeatureKey.Dataflow)
): DataflowInformation {
	return withDataflowBudget(budget, () => {
		const df = extractDataFlowGraph(parser, completeAst, ctx);
		const cut = budget?.exhausted;
		if(cut !== undefined) {
			dataflowLogger.warn(`Dataflow analysis was cut short after ${cut.reached} ${cut.dimension} (budget ${cut.limit}); the graph is partial.`);
			(df as { cutShort?: typeof cut }).cutShort = cut;
		}
		return df;
	});
}

/** The extraction itself, always run inside the {@link withDataflowBudget} scope {@link produceDataFlowGraph} opens. */
function extractDataFlowGraph<OtherInfo>(
	parser:      Parser<KnownParserType>,
	completeAst: NormalizedAst<OtherInfo & ParentInformation>,
	ctx:         FlowrAnalyzerContext
): DataflowInformation {
	// we freeze the files here to avoid endless modifications during processing
	const files = completeAst.ast.files.slice();
	ctx.files.addConsideredFile(files[0].filePath ? files[0].filePath : FlowrFile.INLINE_PATH);

	const env = ctx.env.makeCleanEnv();
	env.current.n = ctx.meta.getNamespace();
	const environment = attachProject(env, ctx);

	const dfData: DataflowProcessorInformation<OtherInfo & ParentInformation> = {
		parser,
		completeAst,
		environment,
		processors:     ctx.config.solver.instrument.dataflowExtractors?.(processors, ctx) ?? processors,
		cds:            undefined,
		referenceChain: [files[0].filePath],
		statementOrder: new Map(),
		ctx
	};
	let df = guardNesting('Dataflow analysis', files[0].filePath, () => processDataflowFor<OtherInfo>(files[0].root, dfData));

	for(let i = 1; i < files.length; i++) {
		/* source requests register automatically */
		df = standaloneSourceFile(i, files[i], dfData, df);
	}

	// resolve linkages and propagate transitive side effects across calls to a fixpoint
	callActiveBindings(df.graph);
	readFramesThroughEnvironment(df.graph);
	df.graph.statementOrder = dfData.statementOrder;
	updateNestedFunctionCalls(df.graph, df.environment, ctx);
	const escapedNames = new Set<string>();
	/* carried across the rounds, so a definition already folded in does not read as growth again */
	const foldedIn = new Set<string>();
	const rounds = ctx.config.solver.transitiveSideEffectRounds ?? DefaultTransitiveSideEffectRounds;
	/* a read of the options or graphics state nothing set reads the state R starts with, unless a write escaping a call replaces it */
	const [initialState, open] = partitionArray(df.in, r => AmbientStateName.is(r.name));
	for(let round = 0; round < rounds; round++) {
		const { environment, grew, escapedNames: roundNames } = Dataflow.sideEffects.propagateTransitive(df.graph, df.environment, ctx, foldedIn, initialState);
		(df as { environment: REnvironmentInformation }).environment = environment;
		for(const n of roundNames) {
			escapedNames.add(n);
		}
		if(!grew) {
			break;
		}
		updateNestedFunctionCalls(df.graph, df.environment, ctx);
	}
	markCallsOfUnknownValues(df.graph, df.environment);
	(df as { in: DataflowInformation['in'] }).in = open.concat(openReadsOfCalledFunctions(df.graph));
	// resolve top-level reads that now see the escaped `<<-` definitions folded in above
	if(escapedNames.size > 0) {
		reResolveOpenReferences(df.graph, df.environment, [...df.in, ...df.unknownReferences], escapedNames);
	}
	// link on-demand-materialized package exports back to their `library()` loaders
	linkMaterializedExportsToLoaders(df.graph, df.environment);
	const cleanEnvironment = ctx.env.makeCleanEnv();
	separateClosureInstances(df.graph, name => queryFnProps(name, { environment: cleanEnvironment }));
	FunctionSemantics.call.quoted.finalize(df.graph, df.environment, completeAst.idMap, () => new ControlFlowGraph(df.graph));
	orderRaisingBodies(df.graph, completeAst.idMap, ctx);
	FunctionSemantics.settleJumpsInPromises(df.graph, df.exitPoints, { ctx });
	linkEnvironmentArgumentsWrittenByCallee(df.graph, df.environment);
	resolveLinkToSideEffects(df.graph, ctx);
	linkResourceReadersToWriters(df.graph, df.environment, ctx);
	linkReadsOfDivertedOutput(df.graph, df.environment);
	separateFileWritesPerCall(df.graph, df.environment, ctx);
	return df;
}
