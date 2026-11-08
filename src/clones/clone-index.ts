import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { buildCloneAst, type CloneAst, ClonePerspective } from './clone-ast';
import { planInlining } from './clone-dataflow';

/**
 * The flat ASTs of all analyzed files, all the clone detectors need. Build it once, store it with
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
export interface SerializedCloneIndex extends CloneIndex {
	readonly format:  'flowr-clone-index';
	readonly version: 2;
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
		const normalized = await analyzer.normalize();
		const dataflow = perspective === ClonePerspective.Dataflow ? await analyzer.dataflow() : undefined;
		const inline = dataflow && planInlining(dataflow.graph, normalized.idMap, dataflow.environment);
		const files = normalized.ast.files.map((f, i) => buildCloneAst(f.root, f.filePath ?? `<input ${i}>`, perspective, inline, dataflow?.graph));
		return { perspective, files };
	},
	/** The JSON form of the index; its node ids belong to the analysis that built it. */
	serialize(this: void, index: CloneIndex): SerializedCloneIndex {
		return { format: 'flowr-clone-index', version: 2, perspective: index.perspective, files: index.files };
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
		if(data.format !== 'flowr-clone-index' || data.version !== 2 || !Object.values(ClonePerspective).includes(data.perspective) || !Array.isArray(data.files)) {
			throw new Error(`unsupported clone index (format ${String(data.format)}, version ${String(data.version)})`);
		}
		return { perspective: data.perspective, files: data.files };
	}
} as const;
