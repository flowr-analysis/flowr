import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isArray } from '../../../util/collections/arrays';
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
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { memoize } from '../../../util/collections/defaultmap';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { DfgVertex, VertexType } from '../../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { TwoLayerCollector } from '../../two-layer-collector';
import { compactRecord } from '../../../util/objects';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { satisfiesCallTargets } from './identify-link-to-last-call-relation';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { identifyLinkToRelation } from './identify-link-to-relation';
import { Identifier } from '../../../dataflow/environments/identifier';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { quotedForWorker } from '../../../dataflow/environments/query-fn-props';
import { ArrayQueue } from '../../../util/collections/queue';
import { baseRExportOwner } from '../../../util/r-base-packages';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';

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
 * A regex is only compiled once the predicate is first asked, as most of the many a query run promotes never are.
 */
export function promoteCallName(callName: CallNameTypes, exact = false): PromotedCallTest {
	if(Array.isArray(callName)) {
		const s = new Set<string>(callName);
		return (t: string) => s.has(t);
	} else if(typeof callName === 'string' && exact) {
		return (t: string) => t === callName;
	}
	const source = typeof callName === 'string' ? callName : exact ? '^' + callName.source + '$' : callName.source;
	let r: RegExp | undefined;
	return (t: string) => (r ??= new RegExp(source)).test(t);
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
	/* many queries share one link, like every plot addon linking to the plot it draws onto */
	const promoteLink = memoize((l: LinkTo): PromotedLinkTo => ({ ...l, callName: promoteCallName(l.callName) }));
	const promotedQueries: PromotedQuery[] = queries.map((q, idx) => {
		const promoted = {
			...q,
			callName:   promoteCallName(q.callName, q.callNameExact),
			exactNames: exactNamesOf(q.callName, q.callNameExact),
			idx,
			fileFilter: q.fileFilter && {
				...q.fileFilter,
				filter: promoteCallName(q.fileFilter.filter)
			}
		};
		if(!isSubCallQuery(q)) {
			return promoted;
		}
		requiresCfg = true;
		return {
			...promoted,
			linkTo: q.linkTo ? isArray<LinkTo>(q.linkTo) ? q.linkTo.map(promoteLink) : promoteLink(q.linkTo) : undefined
		} satisfies PromotedQuery;
	});

	return { promotedQueries, requiresCfg };
}


/**
 * Where the function of a call comes from: the functions it calls and the definition of its name, or the expression
 * computing its callee (`m$r` in `m$r()`). Not its arguments, like the function `lapply(x, function(y) print(y))`
 * is handed, not the other values it reads, like the plot `lines()` draws into or the pipe a pipe continues, and not
 * the built-ins a call of a function definition reaches through its body, like the anonymous call of
 * `lapply(x, function(y) data[y])` does.
 */
function calleesOf(id: NodeId, call: DataflowGraphVertexFunctionCall, outgoing: ReadonlyMap<NodeId, DfEdge>, graph: DataflowGraph): NodeId[] {
	const node = graph.idMap?.get(id);
	const callee = RFunctionCall.isUnnamed(node) ? node.calledFunction.info.id : undefined;
	const name = Identifier.getName(call.name);
	const isBinding = (target: NodeId) => callee === undefined ? DfgVertex.isVariableDefinition(graph.getVertex(target)) && NodeId.recoverBareName(target, graph.idMap) === name : target === callee;
	const callsDefinition = outgoing.entries().some(([t, e]) => DfEdge.includesType(e, EdgeType.Calls) && !NodeId.isBuiltIn(t));
	return outgoing.entries().filter(([target, edge]) => DfEdge.doesNotIncludeType(edge, EdgeType.Argument) && (DfEdge.includesType(edge, EdgeType.Calls)
		? !NodeId.isBuiltIn(target) || !callsDefinition
		: DfEdge.includesType(edge, EdgeType.Reads) && isBinding(target))
	).map(([target]) => target).toArray();
}

/* maybe we want to add caches to this */
/**
 * Whether the name at a vertex the alias walk reaches names a function there: a built-in, a function definition,
 * and a use reading one, a function definition's binding, or nothing (an unknown function), like the `print` of
 * `f <- print`. Not a binding, which holds what its value names, nor a use of one, like the `print` of
 * `print <- gar; f <- print`, which names `gar`.
 */
function namesFunction(id: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.get(id);
	if(vertex === undefined || DfgVertex.isFunctionDefinition(vertex[0])) {
		return true;
	} else if(!DfgVertex.isUse(vertex[0])) {
		return false;
	}
	let reads = false;
	for(const [target, edge] of vertex[1]) {
		if(DfEdge.includesType(edge, EdgeType.Reads)) {
			reads = true;
			if(NodeId.isBuiltIn(target) || graph.edgesFrom(target).entries().some(([t, e]) => DfEdge.includesType(e, EdgeType.DefinedBy) && DfgVertex.isFunctionDefinition(graph.getVertex(t)))) {
				return true;
			}
		}
	}
	return !reads;
}

/**
 * The names of the functions the call at `nodeId` may be a call of, each with the vertices naming it.
 * Without `follow`, only what the call reaches directly, which is all there is when no function of interest is ever
 * used as a value (`f <- read.csv`, `g(read.csv)`, `get("read.csv")`), as then nothing can be an alias of one.
 */
function retrieveAllCallAliases(nodeId: NodeId, graph: DataflowGraph, follow: boolean): Map<string, NodeId[]> {
	/* we want the names of all functions called at the source id, including synonyms and returns */
	const aliases: Map<string, NodeId[]> = new Map();

	const visited = new Set<NodeId>();
	/* we store the current call name alongside each id */
	const queue = new ArrayQueue<readonly [string, NodeId]>([[NodeId.recoverContent(nodeId, graph) ?? '', nodeId]]);

	while(!queue.isEmpty()) {
		const [str, id] = queue.dequeue() as readonly [string, NodeId];
		if(visited.has(id)) {
			continue;
		}
		visited.add(id);
		if(id !== nodeId) {
			if(namesFunction(id, graph)) {
				const present = aliases.get(str);
				if(present) {
					present.push(id);
				} else {
					aliases.set(str, [id]);
				}
			}
			if(!follow) {
				continue;
			}
		}

		const vertex = graph.get(id);
		if(vertex === undefined) {
			continue;
		}
		const [info, outgoing] = vertex;

		if(DfgVertex.isFunctionDefinition(info)) {
			/* the function itself, what it reads (like the `library` call providing a package's) makes no alias */
			continue;
		} else if(!DfgVertex.isFunctionCall(info)) {
			const wantedTypes = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
			const x = outgoing.entries()
				.filter(([,e]) => DfEdge.includesType(e, wantedTypes))
				.map(([t]) => [NodeId.recoverContent(t, graph) ?? '', t] as const)
				.toArray();
			/** only follow defined-by and reads */
			for(const e of x) {
				queue.enqueue(e);
			}
			continue;
		}

		/* a call reached on the way is an alias only for what it hands back, not for what it reads or calls */
		const out = id === nodeId ? calleesOf(id, info, outgoing, graph)
			: outgoing.entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.Returns)).map(([t]) => t);

		for(const call of out) {
			queue.enqueue([NodeId.recoverContent(call, graph) ?? NodeId.recoverContent(id, graph) ?? '', call]);
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

/**
 * Multi-stage call context query resolve.
 *
 * 1. Resolve all calls in the DF graph that match the respective {@link DefaultCallContextQueryFormat#callName} regex.
 * 2. If there is an alias attached, consider all call traces.
 * 3. Identify their respective call targets, if {@link DefaultCallContextQueryFormat#callTargets} is set to be non-any.
 * This happens during the main resolution!
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
	/* index exact-name queries so each name costs one map lookup instead of a predicate check per query */
	const byName = new Map<string, PromotedQuery[]>();
	const patterns: PromotedQuery[] = [];
	for(const query of promotedQueries) {
		if(query.exactNames) {
			for(const name of query.exactNames) {
				const present = byName.get(name);
				if(present) {
					present.push(query);
				} else {
					byName.set(name, [query]);
				}
			}
		} else {
			patterns.push(query);
		}
	}
	const queriesFor = (name: string): readonly PromotedQuery[] => {
		const exact = byName.get(name) ?? [];
		return patterns.length === 0 ? exact : [...exact, ...patterns.filter(q => q.callName(name))];
	};
	const aliasQueries = promotedQueries.filter(q => q.includeAliases);
	/* an alias of a function needs the function used as a value somewhere, like `read.csv` in `f <- read.csv` */
	const followAliases = aliasQueries.length > 0 && dataflow.graph.verticesOfType(VertexType.Use).some(([id]) => {
		const value = NodeId.recoverContent(id, dataflow.graph);
		return value !== undefined && queriesFor(value).some(q => q.includeAliases);
	});

	for(const [nodeId, info] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
		const n = Identifier.getName(info.name);
		/* each query matching the call by its name or, if it asks for them, by the functions it is an alias of */
		const matched = new Map<PromotedQuery, NodeId[] | undefined>(queriesFor(n).map(q => [q, undefined]));
		/* without a function used as a value, a call is only one of its own name, whose roots only matter if it matches */
		if(followAliases || matched.keys().some(q => q.includeAliases)) {
			for(const [alias, ids] of retrieveAllCallAliases(nodeId, dataflow.graph, followAliases)) {
				for(const query of queriesFor(alias)) {
					if(query.includeAliases) {
						matched.set(query, [...matched.get(query) ?? [], ...ids]);
					}
				}
			}
		}
		if(matched.size === 0) {
			continue;
		}
		const matching = [...matched.entries()].sort(([a], [b]) => a.idx - b.idx);
		/* if the call is quoted, we do not want to link to it */
		const quoted = Dataflow.isQuoted(nodeId, dataflow.graph) && !quotedForWorker(nodeId, dataflow.graph, analyzer.inspectContext().env.builtInIndex);
		for(const [query, aliasRoots] of matching) {
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
			if(quoted) {
				continue;
			} else if(query.ignoreParameterValues && isParameterDefaultValue(nodeId, ast)) {
				continue;
			}
			let linkedIds: Set<NodeId | { id: NodeId, info: object }> | undefined = undefined;
			if(cfg && 'linkTo' in query && query.linkTo !== undefined) {
				const linked = isArray<PromotedLinkTo>(query.linkTo) ? query.linkTo : [query.linkTo];
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
				id:         nodeId,
				name:       info.name,
				calls:      targets,
				linkedIds:  linkedIds ? Array.from(linkedIds) : undefined,
				aliasRoots: aliasRoots
			}));
		}
	}

	removeIdenticalDuplicates(initialIdCollector);

	return {
		...metaSince(now),
		kinds: makeReport(initialIdCollector)
	};
}
