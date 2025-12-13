import { internalPrinter, StepOutputFormat } from '../../../print/print';
import { type IPipelineStep , PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import type { SliceResult } from '../../../../slicing/static/slicer-types';
import { reconstructToCode } from '../../../../reconstruct/reconstruct';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AutoSelectPredicate } from '../../../../reconstruct/auto-select/auto-select-defaults';

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
}

function processor(results: { normalize?: NormalizedAst, slice?: SliceResult }, input: Partial<ReconstructRequiredInput>) {
	return reconstructToCode(results.normalize as NormalizedAst, {
		nodes:            (results.slice as SliceResult).result,
		reconstructFiles: input.reconstructFiles
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
