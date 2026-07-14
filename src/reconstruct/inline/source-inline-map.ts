/**
 * Maps each `source()` call node to the index of the file it sources in `ast.ast.files`.
 * {@link reconstructToCode} uses it (via `inlineSources`) to splice a sourced file's reconstruction
 * in place of its `source()` call, yielding one self-contained R text.
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
 * A warning raised while inlining `source()` calls during reconstruction.
 * @see {@link reconstructToCode}
 */
export interface InlineWarning {
	/**
	 * - `cycle`: the `source()` would re-inline a file already being inlined on the current path;
	 *   the literal call is kept at the cycle edge to break the recursion.
	 * - `unresolved`: the `source()` survived the slice but could not be linked to a file
	 *   (dynamic or missing path); the literal call is kept verbatim.
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
	 * Connect each `source()` call node to the index of the file it sources in `ast.ast.files` (index 0 is main).
	 *
	 * A `source()` call lives in its parent file, so we reach its sourced block via the control dependency the
	 * dataflow analysis adds (see {@link sourceRequest}): a vertex whose innermost cd (`cds[0]`) is a source call
	 * belongs to that call's directly sourced block. Every node carries its resolved file in `info.file`, so the
	 * block's `info.file` names the sourced file independent of the call site, and one graph pass resolves all
	 * calls via small map lookups. A file sourced from several sites is stored once but each block still tags the
	 * same `info.file`, so all sites map to that single index (this also drives cycle detection: a re-sourcing
	 * call resolves to an already-visited index).
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

		// resolved file path -> its index (paths are unique per stored file)
		const pathToIndex = new Map<string, number>();
		for(let i = 1; i < files.length; i++) {
			const path = files[i].root.info.file;
			if(path !== undefined) {
				pathToIndex.set(path, i);
			}
		}

		// single pass: collect every source call (with its literal path arg, computed once) and, per control
		// dependency, the first vertex under it (its directly sourced block).
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

		// resolve each call via the `info.file` of the block it directly sources (if it has one)
		for(const callId of sourceArgs.keys()) {
			const block = firstVertexByCd.get(callId);
			const path = block !== undefined ? ast.idMap.get(block)?.info.file : undefined;
			const idx = path !== undefined ? pathToIndex.get(path) : undefined;
			if(idx !== undefined) {
				map.set(callId, idx);
			}
		}

		// a re-source of an already-stored file (a diamond's shared leaf, or a cycle edge) is deduplicated and
		// has no block of its own, so the pass above misses it. Map it by its literal path arg, which another
		// (resolved) call to the same file already fixed.
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
