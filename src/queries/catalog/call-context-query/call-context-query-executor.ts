import type {
	CallContextQuery,
	CallContextQueryKindResult,
	CallContextQueryResult,
	CallContextQuerySubKindResult,
	CallNameTypes,
	FileFilter,
	LinkTo,
	SubCallContextQueryFormat
} from './call-context-query-format';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { TwoLayerCollector } from '../../two-layer-collector';
import { compactRecord } from '../../../util/objects';
import type { BasicQueryData } from '../../base-query-format';
import { satisfiesCallTargets } from './identify-link-to-last-call-relation';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { identifyLinkToRelation } from './identify-link-to-relation';
import { Identifier } from '../../../dataflow/environments/identifier';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { ArrayQueue } from '../../../util/collections/queue';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { executeCallGraphQuery } from '../call-graph-query/call-graph-query-executor';
import { guard, isNotUndefined } from '../../../util/assert';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverContent, recoverName } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex, VertexType } from '../../../dataflow/graph/vertex';
import type {
	ReadOnlyFlowrAnalyzerDependenciesContext
} from '../../../project/context/flowr-analyzer-dependencies-context';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SliceDirection } from '../../../util/slice-direction';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { ControlFlow } from '../../../dataflow/internal/control-flow';
import { ControlFlowGraph } from '../../../control-flow/control-flow-graph';
import { MatchArgs } from '../../../dataflow/graph/match-args';
import { signatureDbOf } from '../../../project/sigdb/signature-db';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../dataflow/eval/resolve/alias-tracking';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import { VariableResolve } from '../../../config';

function makeReport(collector: TwoLayerCollector<string, string, CallContextQuerySubKindResult>): CallContextQueryKindResult {
	const result: CallContextQueryKindResult = {};
	for(const [kind, collected] of collector.store) {
		const subkinds = {} as CallContextQueryKindResult[string]['subkinds'];
		for(const [subkind, values] of collected) {
			if(!Array.isArray(subkinds[subkind])) {
				subkinds[subkind] = [];
			}
			const collectIn = subkinds[subkind];
			for(const value of values) {
				collectIn.push(value);
			}
		}
		result[kind] = {
			subkinds
		};
	}
	return result;
}

function isSubCallQuery(query: CallContextQuery): query is SubCallContextQueryFormat {
	return 'linkTo' in query && query.linkTo !== undefined;
}

export type PromotedCallTest = (t: string) => boolean;

/**
 * Convert a name to a predicate that checks whether an input conforms to this name.
 */
export function promoteCallName(callName: CallNameTypes, exact = false): PromotedCallTest {
	if(Array.isArray(callName)) {
		const s = new Set<string>(callName);
		return (t: string) => s.has(t);
	} else if(typeof callName === 'string') {
		if(exact) {
			return (t: string) => t === callName;
		} else {
			const r = new RegExp(callName);
			return (t: string) => r.test(t);
		}
	} else {
		const r = new RegExp(exact ? '^' + callName.source + '$' : callName.source);
		return (t: string) => r.test(t);
	}
}

// when promoting queries, we convert all strings to regexes, and all string arrays to string sets
type PromotedQuery = Omit<CallContextQuery, 'callName' | 'fileFilter' | 'linkTo'> & {
	callName:    PromotedCallTest,
	/** names the query matches exactly (if any), allowing map-based lookup instead of per-vertex predicate checks */
	exactNames?: readonly string[],
	/** position in the original query list, keeps result order stable */
	idx:         number,
	fileFilter?: FileFilter<PromotedCallTest>,
	linkTo?:     PromotedLinkTo | PromotedLinkTo[]
};
export type PromotedLinkTo<LT = LinkTo> = Omit<LT, 'callName'> & { callName: PromotedCallTest };

/** string arrays always match exactly, plain strings only if the query requests an exact match */
function exactNamesOf(callName: CallNameTypes, exact: boolean | undefined): readonly string[] | undefined {
	if(Array.isArray(callName)) {
		return callName;
	}
	return exact && typeof callName === 'string' ? [callName] : undefined;
}

function promoteQueryCallNames(queries: readonly CallContextQuery[]): {
	promotedQueries: PromotedQuery[],
	requiresCfg:     boolean
} {
	let requiresCfg = false;
	const promotedQueries: PromotedQuery[] = queries.map((q, idx) => {
		if(isSubCallQuery(q)) {
			requiresCfg = true;
			return {
				...q,
				callName:   promoteCallName(q.callName, q.callNameExact),
				exactNames: exactNamesOf(q.callName, q.callNameExact),
				idx,
				fileFilter: q.fileFilter && {
					...q.fileFilter,
					filter: promoteCallName(q.fileFilter.filter)
				},
				linkTo: q.linkTo ? Array.isArray(q.linkTo) ? q.linkTo.map(l => ({
					...l,
					callName: promoteCallName(l.callName)
				})) : {
					...q.linkTo,
					/* we have to add another promotion layer whenever we add something without this call name */
					callName: promoteCallName(q.linkTo.callName)
				} : undefined
			} satisfies PromotedQuery;
		} else {
			return {
				...q,
				callName:   promoteCallName(q.callName, q.callNameExact),
				exactNames: exactNamesOf(q.callName, q.callNameExact),
				idx,
				fileFilter: q.fileFilter && {
					...q.fileFilter,
					filter: promoteCallName(q.fileFilter.filter)
				}
			} satisfies PromotedQuery;
		}
	});

	return { promotedQueries, requiresCfg };
}


/* maybe we want to add caches to this */
function retrieveAllCallAliases(nodeId: NodeId, graph: DataflowGraph): Map<string, NodeId[]> {
	/* we want the names of all functions called at the source id, including synonyms and returns */
	const aliases: Map<string, NodeId[]> = new Map();

	const visited = new Set<NodeId>();
	/* we store the current call name alongside each id */
	const queue = new ArrayQueue<readonly [string, NodeId]>([[recoverContent(nodeId, graph) ?? '', nodeId]]);

	while(!queue.isEmpty()) {
		const [str, id] = queue.dequeue() as readonly [string, NodeId];
		if(visited.has(id)) {
			continue;
		}
		visited.add(id);
		if(id !== nodeId) {
			const present = aliases.get(str);
			if(present) {
				present.push(id);
			} else {
				aliases.set(str, [id]);
			}
		}

		const vertex = graph.get(id);
		if(vertex === undefined) {
			continue;
		}
		const [info, outgoing] = vertex;

		if(info.tag !== VertexType.FunctionCall) {
			const wantedTypes = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
			const x = outgoing.entries()
				.filter(([,e]) => DfEdge.includesType(e, wantedTypes))
				.map(([t]) => [recoverContent(t, graph) ?? '', t] as const)
				.toArray();
			/** only follow defined-by and reads */
			for(const e of x) {
				queue.enqueue(e);
			}
			continue;
		}

		let track = EdgeType.Calls | EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
		if(id !== nodeId) {
			track |= EdgeType.Returns;
		}
		const out = outgoing.entries()
			.filter(([, e]) => DfEdge.includesType(e, track) && (nodeId !== id || DfEdge.doesNotIncludeType(e, EdgeType.Argument)))
			.map(([t]) => t)
		;

		for(const call of out) {
			queue.enqueue([recoverContent(call, graph) ?? recoverContent(id, graph) ?? '', call]);
		}
	}

	return aliases;
}

function removeIdenticalDuplicates(collector: TwoLayerCollector<string, string, CallContextQuerySubKindResult>) {
	for(const [, collected] of collector.store) {
		for(const [subkind, values] of collected) {
			const seen = new Set<string>();
			const newValues = values.filter(v => {
				const str = JSON.stringify(v);
				if(seen.has(str)) {
					return false;
				}
				seen.add(str);
				return true;
			});
			collected.set(subkind, newValues);
		}
	}
}

function doesFilepathMatch(file: string | undefined, filter: FileFilter<PromotedCallTest> | undefined): boolean {
	if(filter === undefined) {
		return true;
	}
	if(file === undefined) {
		return filter.includeUndefinedFiles ?? true;
	}
	return filter.filter(file);
}

/**
 * Whether a bare (unqualified) callee named `name` could originate from `target`, resolved through the
 * signature database: base R's export owner, then any package the loaded sources record as exporting `name`.
 * Only meaningful once the version plugins are initialized (see {@link primeSigDbForNamespaceFilter}).
 */
function bareCallOwnedBy(name: string, target: string, deps: ReadOnlyFlowrAnalyzerDependenciesContext): boolean {
	return baseRExportOwner(name) === target || deps.packagesExporting(name).includes(target);
}

/**
 * Whether a bare-callee sigdb fallback is worth attempting for `queries`: some query filters by
 * {@link CallContextQuery#callTargetNamespace} and a signature source is actually loaded. When so, this also
 * forces the version plugins to initialize (the same {@link ReadOnlyFlowrAnalyzerDependenciesContext#getDependencies}
 * priming the `undefined-symbol` linter relies on) -- otherwise `packagesExporting` answers empty until
 * something else happens to trigger it.
 */
function primeSigDbForNamespaceFilter(queries: readonly PromotedQuery[], deps: ReadOnlyFlowrAnalyzerDependenciesContext): boolean {
	if(!queries.some(q => q.callTargetNamespace !== undefined) || deps.signatureSources().length === 0) {
		return false;
	}
	deps.getDependencies();
	return true;
}

function isParameterDefaultValue(nodeId: NodeId, ast: NormalizedAst): boolean {
	let node = ast.idMap.get(nodeId);
	while(node !== undefined) {
		if(node.info.role === RoleInParent.ParameterDefaultValue) {
			return true;
		}
		const nip = node.info.parent;
		node = nip ? ast.idMap.get(nip) : undefined;
	}
	return false;
}

async function isDependentOn(parameter: string, dep: PromotedCallTest , value: string | undefined, fCall: Required<DataflowGraphVertexFunctionCall>, graph: DataflowGraph, analyzer: ReadonlyFlowrAnalysisProvider): Promise<boolean> {
	const astCall = graph.idMap?.get(fCall?.id) as RFunctionCall<ParentInformation> | undefined;
	if(!RFunctionCall.is(astCall)) {
		return false;
	}
	const defs = MatchArgs.toDefinition(astCall, graph, analyzer.inspectContext());
	//todo: test for multiple steps
	// TODO: match against signaue (so that we can for example slice for the x of a print)
	//Todo: we want to be able to also check for the correct value 
	const slicedParam = new Set<NodeId>();
	const isParam = parameter === '*' ? () => true : (p: string | undefined) => p === parameter;
	if(defs === undefined){
		for(const arg of fCall.args) {
			if(FunctionArgument.isEmpty(arg) || !isParam(arg.name)) {
				continue;
			}
			if(isNotUndefined(arg.name)){
				slicedParam.add(arg.name);
			}
			if(isNotUndefined(value)){
				const result = Resolve.toValue(arg.nodeId, { environment: fCall.environment, graph, full: true, ctx: analyzer.inspectContext(), resolve: VariableResolve.Alias });
			}
			const t = graph.idMap?.get(arg.nodeId) as RArgument;
			if(t.value?.type === 'RFunctionCall' && isNotUndefined((t.value?.functionName as RSymbol).content) && dep(Identifier.getName((t.value?.functionName as RSymbol).content))){
				return true;
			}
			const argSlice = await analyzer.query([{
				type:             'static-slice',
				criteria:         [SlicingCriterion.fromId(arg.nodeId)],
				noReconstruction: true,
				direction:        SliceDirection.Backward
			}]);
			for(const results of Object.values(argSlice['static-slice'].results)) {
				for(const resultId of results.slice.result) {
					const name = recoverName(resultId, graph.idMap);
					if(name && dep(name) && FunctionCallVertex.is(graph.getVertex(resultId))) {
						return true;
					}
				}
			}
		}
	} else {
		for(const [param, arg] of defs){
			if(isParam(param)){
				const argSlice = await analyzer.query([{
					type:             'static-slice',
					criteria:         [SlicingCriterion.fromId(arg.info.id)],
					noReconstruction: true,
					direction:        SliceDirection.Backward
				}]);
				slicedParam.add(param);
				//case: dep is the argument of the call
				if(arg.value?.type === 'RFunctionCall' && isNotUndefined((arg.value?.functionName as RSymbol).content) && dep(Identifier.getName((arg.value?.functionName as RSymbol).content))){
					return true;
				}
				for(const results of Object.values(argSlice['static-slice'].results)) {
					for(const resultId of results.slice.result) {
						const name = recoverName(resultId, graph.idMap);
						const node = graph.idMap?.get(resultId);
						const isFCall = RFunctionCall.is(node)
						if(name && dep(name) && FunctionCallVertex.is(graph.getVertex(resultId))) {
							return true;
						}
					}
				}
			}
		}
	}
	//checks the default-values of the function 	
	//call muss genau eine FunctionDef haben
	const def = graph.idMap?.get(graph.outgoingEdges(fCall.id)?.entries().find(([id, edge]) => {
		return DfEdge.isOnlyType(edge, EdgeType.Calls) && FunctionDefinitionVertex.is(graph.getVertex(id));
	})?.[0] as NodeId)
	const defGraph = graph.getVertex(graph.outgoingEdges(fCall.id)?.entries().find(([id, edge]) => {
		return DfEdge.isOnlyType(edge, EdgeType.Calls) && FunctionDefinitionVertex.is(graph.getVertex(id));
	})?.[0] as NodeId) as DataflowGraphVertexFunctionDefinition
	if(RFunctionDefinition.is(def)){
		for(const param of def.parameters){
			if(isParam(param.name.lexeme) && !slicedParam.has(param.name.lexeme) && isNotUndefined(param.defaultValue?.info.id)){
				const argSlice = await analyzer.query([{
				type:             'static-slice',
				criteria:         [SlicingCriterion.fromId(param.defaultValue.info.id)],
				noReconstruction: true,
				direction:        SliceDirection.Backward
				}]);
				for(const results of Object.values(argSlice['static-slice'].results)) {
					for(const resultId of results.slice.result) {
						const name = recoverName(resultId, graph.idMap);
						if(name && dep(name) && FunctionCallVertex.is(graph.getVertex(resultId))) {
							return true;
						}
					}
				}
			}
		}
	}
	return false;
}

/**
 * Multi-stage call context query resolve.
 *
 * 1. Resolve all calls in the DF graph that match the respective {@link DefaultCallContextQueryFormat#callName} regex.
 * 2. If there is an alias attached, consider all call traces.
 * 3. Identify their respective call targets, if {@link DefaultCallContextQueryFormat#callTargets} is set to be non-any.
 *    This happens during the main resolution!
 * 4. Attach `linkTo` calls to the respective calls.
 */
export async function executeCallContextQueries({ analyzer }: BasicQueryData, queries: readonly CallContextQuery[]): Promise<CallContextQueryResult> {
	const dataflow = await analyzer.dataflow();
	const ast = await analyzer.normalize();
	const deps = analyzer.inspectContext().deps;

	/* omit performance page load */
	const now = Date.now();
	/* the node id and call targets if present */
	const initialIdCollector = new TwoLayerCollector<string, string, CallContextQuerySubKindResult>();

	/* promote all strings to regex patterns */
	const { promotedQueries, requiresCfg } = promoteQueryCallNames(queries);
	const sigDbReady = primeSigDbForNamespaceFilter(promotedQueries, deps);

	let cfg = undefined;
	if(requiresCfg) {
		cfg = await analyzer.controlflow(undefined);
	}
	const calls = cfg ? new Map(dataflow.graph.verticesOfType(VertexType.FunctionCall) as MapIterator<[NodeId, Required<DataflowGraphVertexFunctionCall>]>) : undefined;
	const queriesWhichWantAliases = promotedQueries.filter(q => q.includeAliases);
	/* index exact-name queries so each vertex costs one map lookup instead of a predicate check per query */
	const nonAliasByName = new Map<string, PromotedQuery[]>();
	const nonAliasPatterns: PromotedQuery[] = [];
	for(const query of promotedQueries) {
		if(query.includeAliases) {
			continue;
		}
		if(query.exactNames) {
			for(const name of query.exactNames) {
				const present = nonAliasByName.get(name);
				if(present) {
					present.push(query);
				} else {
					nonAliasByName.set(name, [query]);
				}
			}
		} else {
			nonAliasPatterns.push(query);
		}
	}

	//todo: das hier potentiell verschieben
	const callGraph = (await executeCallGraphQuery({ analyzer }, [{ type: 'call-graph' }])).graph;
	const dataflowGraph = dataflow.graph;

	for(const [nodeId, info] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
		/* if we have a vertex, and we check for aliased calls, we want to know if we define this as desired! */
		if(queriesWhichWantAliases.length > 0) {
			/*
             * yes, we make an expensive call target check, we can probably do a lot of optimization here, e.g.,
             * by checking all of these queries would be satisfied otherwise,
             * in general, we first want a call to happen, i.e., trace the called targets of this!
             */
			const targets = retrieveAllCallAliases(nodeId, dataflow.graph);
			for(const [l, ids] of targets.entries()) {
				for(const query of queriesWhichWantAliases) {
					if(query.callName(l)) {
						initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({ id: nodeId, name: info.name, aliasRoots: ids }));
					}
				}
			}
		}

		const n = Identifier.getName(info.name);
		const byName = nonAliasByName.get(n) ?? [];
		let matching: readonly PromotedQuery[];
		if(nonAliasPatterns.length === 0) {
			matching = byName;
		} else {
			const patternMatches = nonAliasPatterns.filter(q => q.callName(n));
			matching = byName.length === 0 ? patternMatches
				: [...byName, ...patternMatches].sort((a, b) => a.idx - b.idx);
		}
		for(const query of matching) {
			const file = ast.idMap.get(nodeId)?.info.file;
			if(!doesFilepathMatch(file, query.fileFilter)) {
				continue;
			}

			let targets: NodeId[] | 'no' | undefined = undefined;
			if(query.callTargets) {
				targets = satisfiesCallTargets(info, dataflow.graph, query.callTargets);
				if(targets === 'no') {
					continue;
				}
			}
			if(query.callTargetNamespace !== undefined) {
				const pkg = Identifier.getNamespace(Dataflow.qualify(nodeId, dataflow.graph) ?? info.name);
				// a bare callee (no syntactic/resolved namespace) is not yet a mismatch -- consult the sigdb for who exports it
				const owned = pkg === undefined ? sigDbReady && bareCallOwnedBy(n, query.callTargetNamespace, deps) : pkg === query.callTargetNamespace;
				if(!owned) {
					continue;
				}
			}
			if(Dataflow.isQuoted(nodeId, dataflow.graph)) {
				/* if the call is quoted, we do not want to link to it */
				continue;
			} else if(query.ignoreParameterValues && isParameterDefaultValue(nodeId, ast)) {
				continue;
			}
			if(query.reliesOnCriteria) {
				let isDependent = true;
				for(const { name, calls, value } of query.reliesOnCriteria) {
					//guard(value === undefined, 'not yet supported');
					guard(calls !== undefined, 'we want calls req.');
					//alle Bedingungen müssen gelten
					if(!await isDependentOn(name, calls === undefined ? calls : promoteCallName(calls), value, info, dataflowGraph, analyzer)) {
						isDependent = false;
						break;
					}
				}
				if(!isDependent) {
					continue;
				}
			}
			let linkedIds: Set<NodeId | { id: NodeId, info: object }> | undefined = undefined;
			if(cfg && 'linkTo' in query && query.linkTo !== undefined) {
				const linked = Array.isArray(query.linkTo) ? query.linkTo : [query.linkTo];
				for(const link of linked) {
					/* if we have a linkTo query, we have to find the last call */
					const linkTos = await identifyLinkToRelation(nodeId, analyzer, link, calls);
					if(linkTos) {
						linkedIds ??= new Set();
						for(const l of linkTos) {
							if(link.attachLinkInfo) {
								linkedIds.add({ id: l, info: link.attachLinkInfo });
							} else {
								linkedIds.add(l);
							}
						}
					}
				}
			}

			initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({
				id:        nodeId,
				name:      info.name,
				calls:     targets,
				linkedIds: linkedIds ? Array.from(linkedIds) : undefined
			}));
		}
	}

	removeIdenticalDuplicates(initialIdCollector);

	return {
		'.meta': {
			timing: Date.now() - now,
		},
		kinds: makeReport(initialIdCollector)
	};
}
