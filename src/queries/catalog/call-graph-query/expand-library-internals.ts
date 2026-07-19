import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../../../dataflow/graph/call-graph';
import { DataflowGraph } from '../../../dataflow/graph/graph';
import { EdgeType } from '../../../dataflow/graph/edge';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';

/** the internal callees of a library/built-in leaf call, and the package they belong to */
export interface LibraryLeafExpansion {
	readonly pkg:     string;
	readonly callees: readonly string[];
}

/**
 * The transitive internal callees of a library/built-in leaf call `id` (a `built-in:pkg:fn` node id), resolved
 * from the project's loaded signature-database sources -- mirrors the resolution order of
 * {@link ReadOnlyFlowrAnalyzerDependenciesContext#signatureOf}: the project's resolved dependency version first,
 * falling back to the source's latest. `undefined` when `id` is not a package-qualified builtin, or no loaded
 * source can answer it (including when the signature database is disabled or not loaded -- callers treat that
 * as a no-op, leaving the query's default behavior unchanged).
 */
export function transitiveLibraryCallees(id: NodeId, deps: ReadOnlyFlowrAnalyzerDependenciesContext): LibraryLeafExpansion | undefined {
	const pkgFn = NodeId.toPkgFn(id);
	if(pkgFn === undefined) {
		return undefined;
	}
	const [pkg, fn] = pkgFn;
	const version = deps.getDependency(pkg)?.resolvedVersion;
	for(const src of deps.signatureSources()) {
		if(!src.has(pkg)) {
			continue;
		}
		const callees = (version !== undefined ? src.transitiveCallees(pkg, fn, version) : undefined) ?? src.transitiveCallees(pkg, fn);
		if(callees !== undefined) {
			return { pkg, callees };
		}
	}
	return undefined;
}

/**
 * Expands every library/built-in leaf call reachable in `graph` into its internal callees (see
 * {@link transitiveLibraryCallees}), adding one synthetic `pkg:calleeName` edge per expanded callee straight off
 * the leaf. Returns a fresh copy of `graph`; the (cached, shared) input is never mutated.
 */
export function expandCallGraphLibraryInternals(graph: CallGraph, deps: ReadOnlyFlowrAnalyzerDependenciesContext): CallGraph {
	const augmented: CallGraph = new DataflowGraph(graph.idMap);
	augmented.mergeVertices(graph);
	const cache = new Map<NodeId, LibraryLeafExpansion | undefined>();
	for(const [from, tos] of graph.edges()) {
		for(const [to, edge] of tos.entries()) {
			augmented.addEdge(from, to, edge.types);
			if(!NodeId.isBuiltIn(to)) {
				continue;
			}
			if(!cache.has(to)) {
				cache.set(to, transitiveLibraryCallees(to, deps));
			}
			const expansion = cache.get(to);
			if(expansion === undefined) {
				continue;
			}
			for(const callee of expansion.callees) {
				augmented.addEdge(to, NodeId.fromPkgFn(expansion.pkg, callee), EdgeType.Calls);
			}
		}
	}
	return augmented;
}
