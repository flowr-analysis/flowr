import type { DataflowInformation } from './info';
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
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { standaloneSourceFile } from './internal/process/functions/call/built-in/built-in-source';
import { attachProject } from './internal/process/functions/call/built-in/built-in-library';
import { type DataflowGraph, UnknownSideEffect } from './graph/graph';
import { handleUnknownSideEffect } from './graph/unknown-side-effect';
import { ControlFlowGraph } from '../control-flow/control-flow-graph';
import { EdgeType, DfEdge } from './graph/edge';
import { identifyLinkToLastCallRelationSync } from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import { updateNestedFunctionCalls } from './internal/process/functions/call/built-in/built-in-function-definition';
import { reResolveOpenReferences, linkMaterializedExportsToLoaders } from './internal/process/functions/call/built-in/transitive-side-effects';
import type { Environment, REnvironmentInformation } from './environments/environment';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { FlowrFile } from '../project/context/flowr-file';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from './graph/vertex';
import { VertexType, DfgVertex } from './graph/vertex';
import type { LinkToLastCall } from '../queries/catalog/call-context-query/call-context-query-format';
import { Identifier } from './environments/identifier';
import type { InGraphIdentifierDefinition } from './environments/identifier';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId as NodeIdHelper } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SourceRange } from '../util/range';
import { dataflowLogger } from './logger';
import { type DataflowBudgetTracker, GasFeatureKey, GasLevel, GasWikiRef, withDataflowBudget } from '../gas';
import { DefaultTransitiveSideEffectRounds } from '../config';
import { Dataflow } from './graph/df-helper';
import { BuiltInProcName } from './environments/built-in-proc-name';
import { uniqueArray } from '../util/collections/arrays';
import { DefaultMap } from '../util/collections/defaultmap';
import { MatchArgs } from './graph/match-args';
import { ArgProp, SemanticCallTag } from './environments/built-in-props';
import type { ArgProps, BuiltInFnInfo } from './environments/built-in-props';
import type { BuiltInIndex } from './environments/query-fn-props';
import { callFnProps } from './environments/query-fn-props';
import { Resolve } from './environments/resolve-helper';
import { happensBefore } from '../control-flow/happens-before';
import { Ternary } from '../util/logic';
import { guardNesting } from '../util/assert';

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


/**
 * Marks a call that writes into an environment it was handed. An environment is the one R value a callee shares
 * with its caller rather than copying, so `f(e)` with `f <- function(en) en$a <- 42` changes the caller's `e`;
 * where the write lands is not something the graph holds, so the call is what everything reading `e` depends on.
 */
function linkEnvironmentArgumentsWrittenByCallee(graph: DataflowGraph, environment: REnvironmentInformation): void {
	if(!tracksAnyEnvironment(environment)) {
		return;
	}
	for(const [, definition] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const parameters = new Set(Object.keys(definition.params ?? {}).map(NodeIdHelper.normalize));
		if(parameters.size === 0) {
			continue;
		}
		const writesByParameter = new DefaultMap<NodeId, NodeId[]>(() => []);
		writesOfParameters(graph, definition, parameters, writesByParameter, environment);
		for(const [parameter, writes] of writesByParameter.entries()) {
			for(const [argument, bound] of graph.edgesFrom(parameter)) {
				if(!DfEdge.includesType(bound, EdgeType.DefinedByOnCall) || !holdsEnvironment(graph, argument, environment)) {
					continue;
				}
				for(const [call, handed] of graph.edgesTo(argument)) {
					if(!DfEdge.includesType(handed, EdgeType.Argument) || !DfgVertex.isFunctionCall(graph.getVertex(call))) {
						continue;
					}
					handleUnknownSideEffect(graph, environment, call);
					/* the write is the whole point of the call, so it comes along with it */
					for(const write of writes) {
						graph.addEdge(call, write, EdgeType.Reads);
					}
				}
			}
		}
	}
}

/** Whether any binding reachable from `environment` holds a tracked environment; nothing below can link without one. */
function tracksAnyEnvironment(environment: REnvironmentInformation): boolean {
	for(let e: Environment | undefined = environment.current; e !== undefined && !e.builtInEnv; e = e.parent) {
		for(const [, defs] of e.memory) {
			for(const def of defs) {
				if((def as InGraphIdentifierDefinition).envState !== undefined) {
					return true;
				}
			}
		}
	}
	return false;
}

/**
 * Records per parameter of `definition` the replacement calls (`en$a <- v`) its body performs on that parameter,
 * and the unknown-side-effect calls reading it through an argument they state they may write ({@link ArgProp.Written}).
 */
function writesOfParameters(graph: DataflowGraph, definition: DataflowGraphVertexFunctionDefinition, parameters: ReadonlySet<NodeId>, written: DefaultMap<NodeId, NodeId[]>, environment: REnvironmentInformation): void {
	for(const node of definition.subflow.graph) {
		const vertex = graph.getVertex(node);
		/* a replacement marks its target partial, which is the only shape writing into a parameter */
		if(!DfgVertex.isVariableDefinition(vertex) || !vertex.par) {
			if(DfgVertex.isFunctionCall(vertex) && graph.unknownSideEffects.has(NodeIdHelper.normalize(node))) {
				for(const target of argsWithProp(vertex, callFnProps(node, { graph, environment }), ArgProp.Written)) {
					for(const reached of definitionsReachedBy(target, graph)) {
						if(parameters.has(reached)) {
							written.get(reached).push(node);
						}
					}
				}
			}
			continue;
		}
		const onParameter: NodeId[] = [];
		const replacements: NodeId[] = [];
		for(const [target, edge] of graph.edgesFrom(node)) {
			if(DfEdge.includesType(edge, EdgeType.Reads) && parameters.has(target)) {
				onParameter.push(target);
			} else if(DfEdge.includesType(edge, EdgeType.DefinedBy) && DfgVertex.hasOrigin(graph.getVertex(target), BuiltInProcName.Replacement)) {
				replacements.push(target);
			}
		}
		for(const parameter of onParameter) {
			written.get(parameter).push(...replacements);
		}
	}
}

/** The arguments a call states carry `prop`, e.g. what it may write into ({@link ArgProp.Written}) or the resource it works on ({@link ArgProp.Resource}). */
function argsWithProp(vertex: DataflowGraphVertexFunctionCall, info: BuiltInFnInfo | undefined, prop: ArgProps): NodeId[] {
	return info?.sig === undefined ? [] : MatchArgs.findWithProps(vertex.args, info.sig, prop);
}

/** Whether the argument holds a tracked environment, which is what makes the write reach back out of the call. */
function holdsEnvironment(graph: DataflowGraph, argument: NodeId, environment: REnvironmentInformation): boolean {
	const node = graph.idMap?.get(argument);
	if(!RSymbol.is(node)) {
		return false;
	}
	return (Resolve.byName(node.content, environment) ?? [])
		.some(d => (d as InGraphIdentifierDefinition).envState !== undefined);
}

/** The definitions a node reads, following reads through the uses in between until a definition is met. */
function definitionsReachedBy(node: NodeId, graph: DataflowGraph): Set<NodeId> {
	const found = new Set<NodeId>([node]);
	const pending = [node];
	while(pending.length > 0) {
		const current = pending.pop() as NodeId;
		if(DfgVertex.isVariableDefinition(graph.getVertex(current))) {
			continue;
		}
		for(const [target, edge] of graph.edgesFrom(current)) {
			if(DfEdge.includesType(edge, EdgeType.Reads) && !found.has(target)) {
				found.add(target);
				pending.push(target);
			}
		}
	}
	return found;
}

/** Whether two resource arguments may name the same file: they read the same definition or fold to one path. */
function sameResource(a: NodeId, b: NodeId, reachedBy: (id: NodeId) => ReadonlySet<NodeId>, pathOf: (id: NodeId) => string | undefined): boolean {
	if(a === b) {
		return true;
	}
	/* an argument names the file through what it reads (`file = f` reads `f`, which reads its definition), so
	 * two arguments name the same file when the definitions they reach overlap */
	const reachedByA = reachedBy(a);
	for(const t of reachedBy(b)) {
		if(reachedByA.has(t)) {
			return true;
		}
	}
	const path = pathOf(a);
	return path !== undefined && path === pathOf(b);
}

/** The bare names flowR states {@link SemanticCallTag.File} for, which is what a file call has to be named. */
function fileCallNames(index: BuiltInIndex): ReadonlySet<string> {
	return new Set(index.with(SemanticCallTag.File).map(Identifier.getName));
}

/**
 * Links a call reading a file to the calls that wrote it, which is the dependency the file itself carries:
 * `writeLines(x, f); readLines(f)` hands `x` on just as an assignment would. Only what flowR already states
 * takes part -- the tags {@link SemanticCallTag.File} with {@link SemanticCallTag.Reads}/{@link SemanticCallTag.Writes}
 * and the {@link ArgProp.Resource} argument naming the file -- so this holds for every such built-in, not a list of names.
 */
function linkResourceReadersToWriters(graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): void {
	const readers: { id: NodeId, resource: NodeId }[] = [];
	const writers: { id: NodeId, resource: NodeId }[] = [];
	/* a call keeping no environment of its own states what its name does, so every call of that name shares it */
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
		const resource = argsWithProp(vertex, info, ArgProp.Resource)[0];
		if(resource === undefined) {
			continue;   /* writing to the console names no file, and neither does a reader we cannot pin down */
		}
		(reads ? readers : writers).push({ id, resource });
	}
	if(readers.length === 0 || writers.length === 0) {
		return;
	}
	const reached = new Map<NodeId, ReadonlySet<NodeId>>();
	const reachedBy = (id: NodeId): ReadonlySet<NodeId> => {
		let known = reached.get(id);
		if(known === undefined) {
			known = definitionsReachedBy(id, graph);
			reached.set(id, known);
		}
		return known;
	};
	const where = { graph, idMap: graph.idMap, resolve: ctx.config.solver.variables, ctx, environment };
	const paths = new Map<NodeId, string | undefined>();
	const pathOf = (id: NodeId): string | undefined => {
		if(!paths.has(id)) {
			paths.set(id, Resolve.toSingleString(id, where));
		}
		return paths.get(id);
	};
	let cfg: ControlFlowGraph | undefined;
	for(const reader of readers) {
		for(const writer of writers) {
			if(reader.id === writer.id || !sameResource(reader.resource, writer.resource, reachedBy, pathOf)) {
				continue;
			}
			cfg ??= new ControlFlowGraph(graph);
			if(happensBefore(cfg, writer.id, reader.id) !== Ternary.Never) {
				graph.addEdge(reader.id, writer.id, EdgeType.Reads);
			}
		}
	}
}

function resolveLinkToSideEffects(graph: DataflowGraph, ctx: FlowrAnalyzerContext) {
	const gasLevel = ctx.gas.checkGas(GasFeatureKey.SideEffectLinking);
	if(gasLevel >= GasLevel.Critical) {
		dataflowLogger.warn('Skipping side-effect link resolution due to resource pressure (gas: critical). See ' + GasWikiRef);
		return undefined;
	} else if(gasLevel >= GasLevel.Problematic) {
		dataflowLogger.warn('Approaching resource limits during side-effect link resolution (gas: problematic). See ' + GasWikiRef);
	}
	let cf: ControlFlowGraph | undefined = undefined;
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
			// we already know we will not find it!
			continue;
		} else if(allCallNames.length > 0 && !allCallNames.some(name => s.linkTo.callName.test(name))) {
			// we know no call matches the regex
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
		ctx
	};
	let df = guardNesting('Dataflow analysis', files[0].filePath, () => processDataflowFor<OtherInfo>(files[0].root, dfData));

	for(let i = 1; i < files.length; i++) {
		/* source requests register automatically */
		df = standaloneSourceFile(i, files[i], dfData, df);
	}

	// resolve linkages and propagate transitive side effects across calls to a fixpoint
	updateNestedFunctionCalls(df.graph, df.environment, ctx);
	const escapedNames = new Set<string>();
	const rounds = ctx.config.solver.transitiveSideEffectRounds ?? DefaultTransitiveSideEffectRounds;
	for(let round = 0; round < rounds; round++) {
		const { environment, grew, escapedNames: roundNames } = Dataflow.sideEffects.propagateTransitive(df.graph, df.environment, ctx);
		(df as { environment: REnvironmentInformation }).environment = environment;
		for(const n of roundNames) {
			escapedNames.add(n);
		}
		if(!grew) {
			break;
		}
		updateNestedFunctionCalls(df.graph, df.environment, ctx);
	}
	// resolve top-level reads that now see the escaped `<<-` definitions folded in above
	if(escapedNames.size > 0) {
		reResolveOpenReferences(df.graph, df.environment, [...df.in, ...df.unknownReferences], escapedNames);
	}
	// link on-demand-materialized package exports back to their `library()` loaders
	linkMaterializedExportsToLoaders(df.graph, df.environment);
	FunctionSemantics.call.quoted.finalize(df.graph, df.environment, completeAst.idMap, () => new ControlFlowGraph(df.graph));

	linkEnvironmentArgumentsWrittenByCallee(df.graph, df.environment);
	linkResourceReadersToWriters(df.graph, df.environment, ctx);
	resolveLinkToSideEffects(df.graph, ctx);

	return df;
}
