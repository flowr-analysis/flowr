/**
 * Builds the map that connects a `source()` function-call node to the index of the
 * sourced file within the {@link NormalizedAst}'s project (`ast.ast.files`).
 *
 * This map is consumed by {@link reconstructToCode} (via its `inlineSources` option) to splice
 * the reconstruction of a sourced file into the place of the corresponding `source()` call,
 * producing a single self-contained R text.
 * @module
 */
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** the string-literal path argument of a `source()`-like call node, if it has one (else `undefined`) */
function sourceArg(ast: NormalizedAst, callId: NodeId): string | undefined {
	const node = ast.idMap.get(callId);
	const arg = node?.type === RType.FunctionCall ? node.arguments[0] : undefined;
	return arg !== undefined && arg !== EmptyArgument && arg.value?.type === RType.String ? arg.value.content.str : undefined;
}

/**
 * Sourced files receive ids of the form `[<repeat>::]<path>-<sl>:<sc>-<el>:<ec>-<counter>`
 * (see {@link sourcedDeterministicCountingIdGenerator}). This strips the trailing `-<location>-<counter>`
 * and the optional leading `<repeat>::` repeat marker, leaving just the **sourced file `<path>`** — which
 * is the same for every `source()` *call site* of that file (the location is the call site, not the file).
 * Keying on the path is what lets a file sourced from several call sites map to its single stored copy.
 */
function sourcedFilePath(id: NodeId): string {
	return String(id)
		.replace(/-\d+:\d+-\d+:\d+-\d+$/, '') // strip the trailing `-<call location>-<counter>`
		.replace(/^\d+::/, '');               // strip the leading repeated-source marker
}

/**
 * A warning raised while inlining `source()` calls during reconstruction.
 * @see {@link reconstructToCode}
 */
export interface InlineWarning {
	/**
	 * - `cycle`: the `source()` would (re-)inline a file that is already being inlined on the current path.
	 *   The literal call is kept at the cycle edge to break the recursion.
	 * - `unresolved`: the `source()` survived the slice but could not be linked to a sourced file
	 *   (e.g., a dynamic or missing path). The literal call is kept verbatim.
	 */
	readonly kind:   'cycle' | 'unresolved'
	/** the id of the `source()` function-call node that triggered the warning */
	readonly callId: NodeId
	/** the (best-effort) path of the file that was meant to be sourced, if known */
	readonly path?:  string
}

/**
 * Helper functions to link `source()` calls to the files they source for reconstruction inlining.
 * @see {@link SourceInlineMap.build}
 */
export const SourceInlineMap = {
	name: 'SourceInlineMap',
	/**
	 * Connect each `source()` function-call node to the index of the file it sources within `ast.ast.files`.
	 *
	 * The dataflow analysis pushes every sourced file into `ast.ast.files` (index 0 is the main file) and
	 * links the entry point of the sourced content to the `source()` call via a control dependency
	 * (see {@link sourceRequest} - note that the link is a *control dependency*, not a `Reads` edge, because
	 * sourced content is treated as conditionally executed). We therefore follow the control-dependency
	 * back-link: any vertex whose innermost control dependency (`cds[0]`) is a `source()` call belongs to the
	 * block directly sourced by that call; the **path** encoded in that vertex's id ({@link sourcedFilePath})
	 * identifies the sourced file, independent of the call site.
	 *
	 * A file sourced from several call sites is stored only once in `ast.ast.files`, but each call site's block
	 * carries its own (call-site) location in its node ids while sharing the same `<path>` — so keying on the
	 * path (not `path+location`) maps *every* call site to that single stored file. This also underpins cycle
	 * detection during reconstruction (a re-sourcing call resolves to an already-visited file index).
	 *
	 * The graph is walked exactly once: the pass simultaneously records every `source()` call (with its path
	 * argument) and, for each control dependency, the first vertex it dominates. Resolving a call to its file
	 * is then a couple of small map lookups rather than a second full traversal.
	 * @param ast   - the normalized (multi-file) ast
	 * @param graph - the dataflow graph for `ast`
	 * @returns a map from each `source()` call node id to the index of the sourced file in `ast.ast.files`
	 */
	build(ast: NormalizedAst, graph: DataflowGraph): Map<NodeId, number> {
		const files = ast.ast.files;
		const map = new Map<NodeId, number>();
		if(files.length <= 1) {
			return map;
		}

		// sourced-file path -> its index (paths are unique per stored file, so no first-wins ambiguity)
		const pathToIndex = new Map<string, number>();
		for(let i = 1; i < files.length; i++) {
			pathToIndex.set(sourcedFilePath(files[i].root.info.id), i);
		}

		// single graph pass: collect every `source()` call (with its path argument, computed once) and,
		// for each control dependency, the first vertex encountered under it. A vertex whose innermost
		// control dependency is a source call belongs to that call's directly sourced block, so its id
		// encodes the sourced file's path (the same for every call site of that file).
		const sourceArgs = new Map<NodeId, string | undefined>();
		const firstVertexByCd = new Map<NodeId, NodeId>();
		for(const [id, vertex] of graph.vertices(true)) {
			if(isFunctionCallVertex(vertex) && Array.isArray(vertex.origin) && vertex.origin.includes(BuiltInProcName.Source)) {
				sourceArgs.set(id, sourceArg(ast, id));
			}
			const cds = vertex.cds;
			if(cds && cds.length > 0 && !firstVertexByCd.has(cds[0].id)) {
				firstVertexByCd.set(cds[0].id, id);
			}
		}
		if(sourceArgs.size === 0) {
			return map;
		}

		// resolve each source call via the path encoded in the block it directly sources (if it has one)
		for(const callId of sourceArgs.keys()) {
			const block = firstVertexByCd.get(callId);
			const idx = block !== undefined ? pathToIndex.get(sourcedFilePath(block)) : undefined;
			if(idx !== undefined) {
				map.set(callId, idx);
			}
		}

		// second pass: a re-source of an already-stored file is deduplicated in `ast.ast.files`, so it has no
		// block of its own and the resolution above misses it (e.g. a diamond where two files source the same
		// leaf). Map it by its string path argument, which another (resolved) call to that file already fixed.
		const argToIndex = new Map<string, number>();
		for(const [callId, idx] of map) {
			const arg = sourceArgs.get(callId);
			if(arg !== undefined) {
				argToIndex.set(arg, idx);
			}
		}
		for(const [callId, arg] of sourceArgs) {
			if(arg !== undefined && !map.has(callId)) {
				const idx = argToIndex.get(arg);
				if(idx !== undefined) {
					map.set(callId, idx);
				}
			}
		}

		return map;
	}
} as const;
