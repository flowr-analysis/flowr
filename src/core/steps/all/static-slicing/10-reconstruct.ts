import { internalPrinter, StepOutputFormat } from '../../../print/print';
import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import type { SliceResult } from '../../../../slicing/static/slicer-types';
import { reconstructToCode } from '../../../../reconstruct/reconstruct';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AutoSelectPredicate } from '../../../../reconstruct/auto-select/auto-select-defaults';
import type { DataflowInformation } from '../../../../dataflow/info';
import { SourceInlineMap } from '../../../../reconstruct/inline/source-inline-map';

export interface ReconstructRequiredInput {
	autoSelectIf?:     AutoSelectPredicate
	/**
	 * When confronted with a project of multiple files the question for reconstruct arises wrt. which files to rebuild.
	 * This option can be used to either reconstruct all files or only specific files by their index in the project.
	 * By default, (for legacy) this will reconstruct the *first* file (index 0).
	 *
	 * Either you can set this to `'all'` to reconstruct all files or provide an array of file indices in the files context to reconstruct only those files.
	 */
	reconstructFiles?: 'all' | number[]
	/**
	 * Inline resolvable `source()` calls into the reconstruction so the result is a single self-contained R text.
	 * Cyclic and unresolvable `source()` calls are kept verbatim and reported via `reconstruct.inlineWarnings`.
	 */
	inlineSources?:    boolean
}

function processor(results: { normalize?: NormalizedAst, slice?: SliceResult, dataflow?: DataflowInformation }, input: Partial<ReconstructRequiredInput>) {
	const normalize = results.normalize as NormalizedAst;
	return reconstructToCode(normalize, {
		nodes:            (results.slice as SliceResult).result,
		reconstructFiles: input.reconstructFiles,
		inlineSources:    input.inlineSources,
		sourceMap:        input.inlineSources ? SourceInlineMap.build(normalize, (results.dataflow as DataflowInformation).graph) : undefined
	}, input.autoSelectIf);
}

export const NAIVE_RECONSTRUCT = {
	name:              'reconstruct',
	humanReadableName: 'static code reconstruction',
	description:       'Reconstruct R code from the static slice',
	processor,
	executed:          PipelineStepStage.OncePerRequest,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'slice' ],
	requiredInput: undefined as unknown as ReconstructRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'reconstruct', typeof processor>>;
