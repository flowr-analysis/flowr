/**
 * Contains the default pipeline for working with flowr
 */
import type { PipelineInput } from './pipeline';
import { createPipeline } from './pipeline';
import { PARSE_WITH_R_SHELL_STEP } from '../all/core/00-parse';
import { NORMALIZE } from '../all/core/10-normalize';
import { STATIC_DATAFLOW } from '../all/core/20-dataflow';
import { STATIC_SLICE } from '../all/static-slicing/00-slice';
import { NAIVE_RECONSTRUCT } from '../all/static-slicing/10-reconstruct';
import { PARSE_WITH_TREE_SITTER_STEP } from '../all/core/01-parse-tree-sitter';
import { NORMALIZE_TREE_SITTER } from '../all/core/11-normalize-tree-sitter';
import type { KnownParser, Parser } from '../../../r-bridge/parser';
import { PipelineExecutor } from '../../pipeline-executor';

export const DEFAULT_SLICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE = DEFAULT_SLICING_PIPELINE;
export const DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE);
export const TREE_SITTER_SLICING_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE = TREE_SITTER_SLICING_PIPELINE;
export const TREE_SITTER_SLICE_WITHOUT_RECONSTRUCT_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW, STATIC_SLICE);

export const DEFAULT_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW);
export const TREE_SITTER_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW);

export const DEFAULT_NORMALIZE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE);
export const TREE_SITTER_NORMALIZE_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER);

export const DEFAULT_PARSE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP);
export const TREE_SITTER_PARSE_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP);

export function createParsePipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_PARSE_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_PARSE_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_PARSE_PIPELINE> {
	const base = parser.name === 'tree-sitter' ? TREE_SITTER_PARSE_PIPELINE : DEFAULT_PARSE_PIPELINE;
	return new PipelineExecutor(base as typeof DEFAULT_PARSE_PIPELINE, {
		parser: parser as Parser<string>,
		...inputs
	});
}

export function createSlicePipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_SLICING_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_SLICING_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_SLICING_PIPELINE> {
	const base = parser.name === 'tree-sitter' ? TREE_SITTER_SLICING_PIPELINE : DEFAULT_SLICING_PIPELINE;
	return new PipelineExecutor(base as typeof DEFAULT_SLICING_PIPELINE, {
		parser: parser as Parser<string>,
		...inputs
	});
}

export function createNormalizePipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_NORMALIZE_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_NORMALIZE_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_NORMALIZE_PIPELINE> {
	const base = parser.name === 'tree-sitter' ? TREE_SITTER_NORMALIZE_PIPELINE : DEFAULT_NORMALIZE_PIPELINE;
	return new PipelineExecutor(base as typeof DEFAULT_NORMALIZE_PIPELINE, {
		parser: parser as Parser<string>,
		...inputs
	});
}

export function createDataflowPipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_DATAFLOW_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_DATAFLOW_PIPELINE> {
	const base = parser.name === 'tree-sitter' ? TREE_SITTER_DATAFLOW_PIPELINE : DEFAULT_DATAFLOW_PIPELINE;
	return new PipelineExecutor(base as typeof DEFAULT_DATAFLOW_PIPELINE, {
		parser: parser as Parser<string>,
		...inputs
	});
}
