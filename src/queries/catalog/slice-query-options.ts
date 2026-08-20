/**
 * The options shared by the queries that slice the dataflow graph (`static-slice` and `dice`), so both offer the
 * same knobs without repeating their definition, schema, or reconstruction handling.
 * @module
 */
import Joi from 'joi';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { CriteriaParseError, SlicingCriteria } from '../../slicing/criterion/parse';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { type InlineFull, type ReconstructionResult, reconstructToCode } from '../../reconstruct/reconstruct';
import { SourceInlineMap } from '../../reconstruct/inline/source-inline-map';
import { doNotAutoSelect } from '../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../reconstruct/auto-select/magic-comments';

/** The options every slicing query understands, independent of how it picks the nodes to keep. */
export interface SliceQueryOptions {
	/** do not reconstruct the slice into readable code */
	readonly noReconstruction?: boolean
	/** Should the magic comments (force-including lines within the slice) be ignored? */
	readonly noMagicComments?:  boolean
	/**
	 * Inline resolvable `source()` calls into the reconstruction so the result is a single self-contained R text.
	 * Cyclic and unresolvable `source()` calls are kept verbatim and reported via `reconstruct.inlineWarnings`.
	 */
	readonly inlineSources?:    boolean
	/**
	 * Inline _every_ file into the reconstruction, in flowR's loading order (which respects implicit sources),
	 * independent of whether it is sourced explicitly; `'banner'` additionally precedes each file with a banner
	 * comment naming it. Overrides {@link inlineSources}.
	 */
	readonly inlineFull?:       InlineFull
	/**
	 * If set (and slicing backward), continue the slice past a function-definition boundary, also including
	 * the definition's binding and call sites. Defaults to `false`.
	 */
	readonly includeCallees?:   boolean
	/**
	 * Reconstruct the slice as the project's files rather than as one program, reported in
	 * {@link ReconstructionResult#files} in loading order with their paths. Without this only the entry file is
	 * reconstructed. Overridden by {@link inlineSources}/{@link inlineFull}, which produce the opposite.
	 */
	readonly perFile?:          boolean
	/** Also report the packages the slice calls into; see {@link Dataflow.packagesOf}. */
	readonly reportPackages?:   boolean
}

/** The Joi keys of {@link SliceQueryOptions}, to be spread into the schema of every slicing query. */
export const SliceQueryOptionsSchema = {
	noReconstruction: Joi.boolean().optional().description('Do not reconstruct the slice into readable code.'),
	noMagicComments:  Joi.boolean().optional().description('Should the magic comments (force-including lines within the slice) be ignored?'),
	inlineSources:    Joi.boolean().optional().description('Inline resolvable source() calls into the reconstruction so the result is a single self-contained R text.'),
	inlineFull:       Joi.alternatives(Joi.boolean(), Joi.string().valid('banner')).optional().description('Inline all files into the reconstruction, in flowR\'s loading order and independent of whether they are sourced explicitly; "banner" precedes every file with a banner comment naming it.'),
	includeCallees:   Joi.boolean().optional().description('If set (and slicing backward), continue the slice past a function-definition boundary, also including the definition\'s binding and call sites.'),
	perFile:          Joi.boolean().optional().description('Reconstruct the slice as the project\'s files, reported in `reconstruct.files` in loading order with their paths, instead of only the entry file.'),
	reportPackages:   Joi.boolean().optional().description('Also report the packages the slice calls into, i.e. what this selection needs installed rather than what the whole program loads.')
} as const;

/**
 * Resolves the criteria to their node ids, reporting those that match no node: they would slice nothing,
 * as {@link SlicingCriteria.convertAll} keeps them verbatim.
 */
export function resolveSliceCriteria(criteria: SlicingCriteria, ast: NormalizedAst): NodeId[] {
	const ids = SlicingCriteria.convertAll(criteria, ast.idMap);
	const unresolved = criteria.filter((_, i) => !ast.idMap.has(ids[i]));
	if(unresolved.length > 0) {
		throw new CriteriaParseError(`the slicing criteria ${unresolved.map(c => `'${c}'`).join(', ')} match no element of the program`);
	}
	return ids;
}

/** Reconstruct the given `nodes` of `ast`, honoring the inlining, per-file, and magic-comment options. */
export function reconstructSlice(ast: NormalizedAst, graph: DataflowGraph, nodes: ReadonlySet<NodeId>, options: SliceQueryOptions): ReconstructionResult {
	const { inlineSources, inlineFull, perFile, noMagicComments } = options;
	const inlining = inlineSources || inlineFull;
	return reconstructToCode(ast, {
		nodes,
		inlineSources,
		inlineFull,
		reconstructFiles: perFile && !inlining ? 'all' : undefined,
		sourceMap:        inlining ? SourceInlineMap.build(ast, graph) : undefined
	}, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect));
}
