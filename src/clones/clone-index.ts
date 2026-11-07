import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { buildCloneAst, type CloneAst, type CloneFunction, ClonePerspective } from './clone-ast';
import { planInlining } from './clone-dataflow';
import { buildPdg, type Pdg } from './algorithms/similar';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

/**
 * Everything the clone detectors need from an analyzed project: the flat ASTs of all files and, if requested,
 * the program dependence graph of every function (SimilaR). Building it is the only step that needs the parser and
 * the dataflow analysis; detection then works on the index alone, so an index can be built once, stored with
 * {@link CloneIndex.serialize}, and searched again later (e.g., new code against a corpus of pre-analyzed projects).
 */
export interface CloneIndex {
	readonly perspective: ClonePerspective;
	readonly files:       readonly CloneAst[];
	/** `pdgs[f][k]` is the PDG of `files[f].functions[k]`, present if the index was built with PDGs */
	readonly pdgs?:       readonly (readonly Pdg[])[];
}

export interface CloneIndexOptions {
	readonly perspective: ClonePerspective;
	/** build the program dependence graphs of all functions (needs the dataflow graph) */
	readonly pdgs:        boolean;
}

/** The serialized (JSON) form of a {@link CloneIndex}. */
export interface SerializedCloneIndex {
	readonly format:      'flowr-clone-index';
	readonly version:     1;
	readonly perspective: ClonePerspective;
	readonly files:       readonly SerializedCloneAst[];
	readonly pdgs?:       readonly (readonly SerializedPdg[])[];
}

interface SerializedCloneAst {
	readonly file:      string;
	readonly kind:      readonly number[];
	readonly op:        readonly string[];
	readonly lex:       readonly number[];
	readonly text:      readonly string[];
	readonly size:      readonly number[];
	readonly parent:    readonly number[];
	readonly id:        readonly NodeId[];
	readonly span:      readonly number[];
	readonly functions: readonly CloneFunction[];
}

interface SerializedPdg {
	readonly color: readonly number[];
	readonly node:  readonly number[];
	readonly edges: readonly number[];
}

/**
 * Helper functions for the {@link CloneIndex}.
 */
export const CloneIndex = {
	name: 'CloneIndex',
	/**
	 * Builds the index of all files the analyzer knows. The dataflow analysis only runs if the perspective is
	 * `dataflow` or PDGs are requested.
	 */
	async build(this: void, analyzer: ReadonlyFlowrAnalysisProvider, options: CloneIndexOptions): Promise<CloneIndex> {
		const normalized = await analyzer.normalize();
		const needsDataflow = options.perspective === ClonePerspective.Dataflow || options.pdgs;
		const graph = needsDataflow ? (await analyzer.dataflow()).graph : undefined;
		const inline = options.perspective === ClonePerspective.Dataflow && graph ? planInlining(graph, normalized.idMap) : undefined;
		const files = normalized.ast.files.map((f, i) => buildCloneAst(f.root, f.filePath ?? `<input ${i}>`, options.perspective, inline, options.perspective === ClonePerspective.Dataflow ? graph : undefined));
		if(!options.pdgs || !graph) {
			return { perspective: options.perspective, files };
		}
		const pdgs = files.map(ast => ast.functions.map(fn => {
			const def = normalized.idMap.get(ast.id[fn.node]);
			return buildPdg(def as RFunctionDefinition<ParentInformation>, ast, graph);
		}));
		return { perspective: options.perspective, files, pdgs };
	},
	serialize(this: void, index: CloneIndex): SerializedCloneIndex {
		return {
			format:      'flowr-clone-index',
			version:     1,
			perspective: index.perspective,
			files:       index.files.map(f => ({
				file:      f.file,
				kind:      Array.from(f.kind),
				op:        f.op,
				lex:       Array.from(f.lex),
				text:      f.text,
				size:      Array.from(f.size),
				parent:    Array.from(f.parent),
				id:        f.id,
				span:      Array.from(f.span),
				functions: f.functions
			})),
			pdgs: index.pdgs?.map(ps => ps.map(p => ({ color: Array.from(p.color), node: Array.from(p.node), edges: Array.from(p.edges) })))
		};
	},
	deserialize(this: void, data: SerializedCloneIndex): CloneIndex {
		if(data.format !== 'flowr-clone-index' || data.version !== 1) {
			throw new Error(`unsupported clone index format ${String(data.format)} version ${String(data.version)}`);
		}
		const files = data.files;
		if(typeof (files as { length?: unknown } | undefined)?.length !== 'number' || !Object.values(ClonePerspective).includes(data.perspective)) {
			throw new Error('malformed clone index: it needs a known perspective and an array of files');
		}
		return {
			perspective: data.perspective,
			files:       files.map(f => ({
				file:      f.file,
				kind:      Uint8Array.from(f.kind),
				op:        f.op,
				lex:       Int32Array.from(f.lex),
				text:      f.text,
				size:      Int32Array.from(f.size),
				parent:    Int32Array.from(f.parent),
				id:        f.id,
				span:      Int32Array.from(f.span),
				functions: f.functions
			})),
			pdgs: data.pdgs?.map(ps => ps.map(p => ({ color: Uint8Array.from(p.color), node: Int32Array.from(p.node), edges: Int32Array.from(p.edges) })))
		};
	}
} as const;
