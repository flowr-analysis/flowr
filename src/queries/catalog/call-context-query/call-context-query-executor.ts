import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isArray, uniqueArrayBy } from '../../../util/collections/arrays';
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
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../../dataflow/graph/vertex';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { TwoLayerCollector } from '../../two-layer-collector';
import { compactRecord } from '../../../util/objects';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { satisfiesCallTargets } from './identify-link-to-last-call-relation';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { identifyLinkToRelation } from './identify-link-to-relation';
import { Identifier, type BrandedIdentifier, type BrandedNamespace } from '../../../dataflow/environments/identifier';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { quotedForWorker } from '../../../dataflow/environments/query-fn-props';
import { ArrayQueue } from '../../../util/collections/queue';
import { baseRExportOwner } from '../../../util/r-base-packages';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';

/** The report of what was collected, dropping results identical to an earlier one of the same subkind. */
function makeReport(collector: TwoLayerCollector<string, string, CallContextQuerySubKindResult>): CallContextQueryKindResult {
	return Object.fromEntries(collector.store.entries().map(([kind, collected]) =>
		[kind, { subkinds: Object.fromEntries(collected.entries().map(([subkind, values]) => [subkind, uniqueArrayBy(values, v => JSON.stringify(v))])) }]));
}

function isSubCallQuery(query: CallContextQuery): query is SubCallContextQueryFormat {
	return 'linkTo' in query && query.linkTo !== undefined;
}

export type PromotedCallTest = (t: BrandedIdentifier) => boolean;

/**
 * Convert a name to a predicate that checks whether an input conforms to this name.
 * A regex is only compiled once the predicate is first asked, as most of the many a query run promotes never are.
 */
export function promoteCallName(callName: CallNameTypes, exact = false): PromotedCallTest {
	if(Array.isArray(callName)) {
		const s = new Set<BrandedIdentifier>(callName);
		return (t: BrandedIdentifier) => s.has(t);
	} else if(typeof callName === 'string' && exact) {
		return (t: BrandedIdentifier) => t === callName;
	}
	const source = typeof callName === 'string' ? callName : exact ? '^' + callName.source + '$' : callName.source;
	let r: RegExp | undefined;
	return (t: BrandedIdentifier) => (r ??= new RegExp(source)).test(t);
}

// when promoting queries, we convert all strings to regexes, and all string arrays to string sets
type PromotedQuery = Omit<CallContextQuery, 'callName' | 'fileFilter' | 'linkTo'> & {
	callName:    PromotedCallTest,
	/** names the query matches exactly (if any), allowing map-based lookup instead of per-vertex predicate checks */
	exactNames?: readonly BrandedIdentifier[],
	/** position in the original query list, keeps result order stable */
	idx:         number,
	fileFilter?: FileFilter<PromotedCallTest>,
	linkTo?:     PromotedLinkTo | PromotedLinkTo[]
};
export type PromotedLinkTo<LT = LinkTo> = Omit<LT, 'callName'> & { callName: PromotedCallTest };

/** string arrays always match exactly, plain strings only if the query requests an exact match */
function exactNamesOf(callName: CallNameTypes, exact: boolean | undefined): readonly BrandedIdentifier[] | undefined {
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
			fileFilter: q.fileFilter && { ...q.fileFilter, filter: promoteCallName(q.fileFilter.filter) }
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
function namesFunction(id: NodeId, graph: DataflowGraph, known: Map<NodeId, boolean>): boolean {
	let names = known.get(id);
	if(names === undefined) {
		names = decideNamesFunction(id, graph);
		known.set(id, names);
	}
	return names;
}

/** Whether the vertex at `id` names a function, a definition or a use reading one or reading nothing at all. */
function decideNamesFunction(id: NodeId, graph: DataflowGraph): boolean {
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
 * The names `asked` accepts of the functions the call at `nodeId` may be a call of, each with the vertices naming it.
 * Without `follow`, only what the call reaches directly, which is all there is when no function of interest is ever
 * used as a value (`f <- read.csv`, `g(read.csv)`, `get("read.csv")`), as then nothing can be an alias of one.
 * Given `below` (see {@link wantedBelow}), the walk only gives the functions asked for and, past the callee, only enters a vertex
 * from which it can still find one it has not found yet.
 */
function retrieveAllCallAliases(nodeId: NodeId, graph: DataflowGraph, follow: boolean, known: Map<NodeId, boolean>, wanted: WantedBelow | undefined, asked: (name: string) => boolean): Map<string, NodeId[]> {
	/* we want the names of all functions called at the source id, including synonyms and returns */
	const aliases: Map<string, NodeId[]> = new Map();

	const visited = new Set<NodeId>();
	/* the wanted functions found so far, and whether one past the callee is still to be found from a vertex */
	let found = 0n;
	const leadsOn = (id: NodeId) => wanted === undefined || ((wanted.below.get(id) ?? 0n) & ~found) !== 0n;
	/* the callees are what the call names, whatever they reach */
	const firstLevel = new Set<NodeId>();
	/* we store the current call name alongside each id */
	const queue = new ArrayQueue<readonly [string, NodeId]>([[NodeId.recoverContent(nodeId, graph) ?? '', nodeId]]);

	for(let next = queue.dequeue(); next !== undefined; next = queue.dequeue()) {
		const [str, id] = next;
		if(visited.has(id) || (id !== nodeId && !leadsOn(id) && !firstLevel.has(id))) {
			continue;
		}
		visited.add(id);
		if(id !== nodeId) {
			found |= wanted?.bits.get(id) ?? 0n;
			if(asked(str) && namesFunction(id, graph, known)) {
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
				/* past the callee, what reaches no name asked for only names functions nobody asks about */
				if(leadsOn(e[1])) {
					queue.enqueue(e);
				}
			}
			continue;
		}

		/* a call reached on the way is an alias only for what it hands back, not for what it reads or calls */
		const out = id === nodeId ? calleesOf(id, info, outgoing, graph)
			: outgoing.entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.Returns)).map(([t]) => t);

		for(const call of out) {
			if(id === nodeId) {
				firstLevel.add(call);
			} else if(!leadsOn(call)) {
				continue;
			}
			queue.enqueue([NodeId.recoverContent(call, graph) ?? NodeId.recoverContent(id, graph) ?? '', call]);
		}
	}

	return aliases;
}

/**
 * For each vertex from which the alias walk of {@link retrieveAllCallAliases} can reach a function with a name that `wanted` accepts,
 * those functions as bits, so a walk can stop at a vertex once it has found all of them. A variable merely called like one
 * (the `from` of `seq(from, to)`, not `import::from`) names no function. Vertices reaching none are left out.
 */
interface WantedBelow {
	/** the wanted functions each vertex reaches */
	readonly below: ReadonlyMap<NodeId, bigint>
	/** the bit of each wanted function */
	readonly bits:  ReadonlyMap<NodeId, bigint>
}

/** {@link WantedBelow} of the graph. */
function wantedBelow(graph: DataflowGraph, wanted: (name: string) => boolean, known: Map<NodeId, boolean>): WantedBelow {
	const out = new Map<NodeId, NodeId[]>();
	const into = new Map<NodeId, NodeId[]>();
	const bits = new Map<NodeId, bigint>();
	for(const [id, info] of graph.vertices(true)) {
		if(DfgVertex.isFunctionDefinition(info)) {
			continue;
		}
		const call = DfgVertex.isFunctionCall(info);
		const types = call ? EdgeType.Returns : EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
		const targets: NodeId[] = [];
		for(const [target, edge] of graph.edgesFrom(id)) {
			if(!DfEdge.includesType(edge, types)) {
				continue;
			}
			targets.push(target);
			const name = NodeId.recoverContent(target, graph) ?? (call ? NodeId.recoverContent(id, graph) : undefined) ?? '';
			if(!bits.has(target) && wanted(name) && namesFunction(target, graph, known)) {
				bits.set(target, 1n << BigInt(bits.size));
			}
			const sources = into.get(target);
			if(sources) {
				sources.push(id);
			} else {
				into.set(target, [id]);
			}
		}
		out.set(id, targets);
	}
	/* only what reaches a wanted function matters */
	const reaching = new Set(bits.keys());
	const back = new ArrayQueue<NodeId>([...reaching]);
	for(let next = back.dequeue(); next !== undefined; next = back.dequeue()) {
		for(const source of into.get(next) ?? []) {
			if(!reaching.has(source)) {
				reaching.add(source);
				back.enqueue(source);
			}
		}
	}
	for(const [id, targets] of out) {
		out.set(id, targets.filter(t => reaching.has(t)));
	}
	/* the strongly connected components of what reaches one (Tarjan, without recursion), each complete after those it reaches */
	const below = new Map<NodeId, bigint>();
	const index = new Map<NodeId, number>();
	const low = new Map<NodeId, number>();
	const stack: NodeId[] = [];
	const onStack = new Set<NodeId>();
	for(const root of reaching) {
		if(index.has(root)) {
			continue;
		}
		const frames: [NodeId, number][] = [[root, 0]];
		index.set(root, index.size);
		low.set(root, index.get(root) as number);
		stack.push(root);
		onStack.add(root);
		while(frames.length > 0) {
			const frame = frames[frames.length - 1];
			const [v] = frame;
			const succ = out.get(v) ?? [];
			if(frame[1] < succ.length) {
				const w = succ[frame[1]++];
				if(!index.has(w)) {
					index.set(w, index.size);
					low.set(w, index.get(w) as number);
					stack.push(w);
					onStack.add(w);
					frames.push([w, 0]);
				} else if(onStack.has(w)) {
					low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
				}
				continue;
			}
			frames.pop();
			if(frames.length > 0) {
				const parent = frames[frames.length - 1][0];
				low.set(parent, Math.min(low.get(parent) as number, low.get(v) as number));
			}
			if(low.get(v) === index.get(v)) {
				const members = stack.splice(stack.lastIndexOf(v));
				members.forEach(m => onStack.delete(m));
				let mask = 0n;
				for(const m of members) {
					mask |= bits.get(m) ?? 0n;
					for(const t of out.get(m) ?? []) {
						mask |= below.get(t) ?? 0n;
					}
				}
				for(const m of members) {
					below.set(m, mask);
				}
			}
		}
	}
	return { below, bits };
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
function bareCallOwnedBy(name: BrandedIdentifier, target: BrandedNamespace, deps: ReadOnlyFlowrAnalyzerDependenciesContext): boolean {
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
	const byName = new Map<BrandedIdentifier, PromotedQuery[]>();
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
	function queriesFor(name: BrandedIdentifier): readonly PromotedQuery[] {
		const exact = byName.get(name) ?? [];
		return patterns.length === 0 ? exact : [...exact, ...patterns.filter(q => q.callName(name))];
	}
	const aliasQueries = promotedQueries.filter(q => q.includeAliases);
	/* an alias of a function needs the function used as a value somewhere, like `read.csv` in `f <- read.csv` */
	const followAliases = aliasQueries.length > 0 && dataflow.graph.verticesOfType(VertexType.Use).some(([id]) => {
		const value = NodeId.recoverContent(id, dataflow.graph);
		return value !== undefined && queriesFor(value).some(q => q.includeAliases);
	});

	/* only the aliases some query asks for count */
	const asksAliases = (name: string) => queriesFor(name).some(q => q.includeAliases);
	/* whether a vertex names a function is the same for every call reaching it */
	const namesFunctionOf = new Map<NodeId, boolean>();
	/* a call whose own name asks for no aliases only has some if its walk reaches a function asked for */
	const wanted = followAliases ? wantedBelow(dataflow.graph, asksAliases, namesFunctionOf) : undefined;
	for(const [nodeId, info] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
		const n = Identifier.getName(info.name);
		/* each query matching the call by its name or, if it asks for them, by the functions it is an alias of */
		const matched = new Map<PromotedQuery, NodeId[] | undefined>(queriesFor(n).map(q => [q, undefined]));
		/* without a function used as a value, a call is only one of its own name, whose roots only matter if it matches */
		const ownAliases = matched.keys().some(q => q.includeAliases);
		if(ownAliases || (wanted !== undefined && calleesOf(nodeId, info, dataflow.graph.edgesFrom(nodeId), dataflow.graph).some(c => wanted.below.has(c)))) {
			for(const [alias, ids] of retrieveAllCallAliases(nodeId, dataflow.graph, followAliases, namesFunctionOf, wanted, asksAliases)) {
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

	return { ...metaSince(now), kinds: makeReport(initialIdCollector) };
}
