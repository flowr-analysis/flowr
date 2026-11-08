import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { type CloneAst, ClonePerspective } from './clone-ast';
import { planInlining } from './clone-dataflow';
import type { RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * The normalized ASTs of all analyzed files, all the clone detectors need. Build it once, store it with
 * {@link CloneIndex.serialize}, and search new code against it later.
 */
export interface CloneIndex {
	readonly perspective: ClonePerspective;
	readonly files:       readonly CloneAst[];
}

export interface CloneIndexOptions {
	readonly perspective: ClonePerspective;
}

/** The JSON form of a {@link CloneIndex}. */
export interface SerializedCloneIndex {
	readonly format:      'flowr-clone-index';
	readonly version:     1;
	readonly perspective: ClonePerspective;
	readonly files:       readonly (Omit<CloneAst, 'inline'> & { readonly inline?: { readonly replace: [NodeId, RNodeWithParent][], readonly drop: NodeId[] } })[];
}

/**
 * Helper functions for the {@link CloneIndex}.
 * @helper project
 */
export const CloneIndex = {
	name: 'CloneIndex',
	/**
	 * Indexes all files of the analyzer; only the {@link ClonePerspective.Dataflow} perspective runs the dataflow analysis.
	 * @example
	 * ```ts
	 * const index = await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical });
	 * const { pairs } = detectClones(index, DefaultCloneDetectionConfig);
	 * ```
	 */
	async build(this: void, analyzer: ReadonlyFlowrAnalysisProvider, { perspective }: CloneIndexOptions): Promise<CloneIndex> {
		const { ast, idMap } = await analyzer.normalize();
		const dataflow = perspective === ClonePerspective.Dataflow ? await analyzer.dataflow() : undefined;
		const files = ast.files.map(({ root, filePath }, i) => ({
			file: filePath ?? `<input ${i}>`,
			root,
			...(dataflow ? { inline: planInlining(root, dataflow.graph, idMap, dataflow.environment) } : {})
		}));
		return { perspective, files };
	},
	/** The JSON form of the index; its node ids belong to the analysis that built it. */
	serialize(this: void, { perspective, files }: CloneIndex): SerializedCloneIndex {
		return {
			format:  'flowr-clone-index',
			version: 1,
			perspective,
			files:   files.map(({ file, root, inline }) => ({ file, root, ...(inline ? { inline: { replace: [...inline.replace], drop: [...inline.drop] } } : {}) }))
		};
	},
	/**
	 * The inverse of {@link CloneIndex.serialize}, throws on another format or version.
	 * @example
	 * ```ts
	 * const corpus = CloneIndex.deserialize(JSON.parse(stored) as SerializedCloneIndex);
	 * detectClones(index, DefaultCloneDetectionConfig, corpus); // only clones between index and corpus
	 * ```
	 */
	deserialize(this: void, data: SerializedCloneIndex): CloneIndex {
		const stored: SerializedCloneIndex['files'] = data.files;
		if(data.format !== 'flowr-clone-index' || data.version !== 1 || !Object.values(ClonePerspective).includes(data.perspective) || !Array.isArray(data.files)) {
			throw new Error(`unsupported clone index (format ${String(data.format)}, version ${String(data.version)})`);
		}
		const files = stored.map(({ file, root, inline }): CloneAst => ({ file, root, ...(inline ? { inline: { replace: new Map(inline.replace), drop: new Set(inline.drop) } } : {}) }));
		return { perspective: data.perspective, files };
	}
} as const;
