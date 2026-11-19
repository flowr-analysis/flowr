/** Contains the default pipeline for working with flowR */
import { type Pipeline, type PipelineInput, createPipeline } from './pipeline';
import { PARSE_WITH_R_SHELL_STEP } from '../all/core/00-parse';
import { NORMALIZE } from '../all/core/10-normalize';
import { STATIC_DATAFLOW } from '../all/core/20-dataflow';
import { STATIC_SLICE } from '../all/static-slicing/00-slice';
import { NAIVE_RECONSTRUCT } from '../all/static-slicing/10-reconstruct';
import { PARSE_WITH_TREE_SITTER_STEP } from '../all/core/01-parse-tree-sitter';
import { NORMALIZE_TREE_SITTER } from '../all/core/11-normalize-tree-sitter';
import { type KnownParser, type Parser, ParserName } from '../../../r-bridge/parser';
import { PipelineExecutor } from '../../pipeline-executor';
import type { RShell } from '../../../r-bridge/shell';
import type { TreeSitterExecutor } from '../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

export const DEFAULT_SLICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE);
export const TREE_SITTER_SLICING_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const TREE_SITTER_SLICE_WITHOUT_RECONSTRUCT_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW, STATIC_SLICE);

/**
 * The default pipeline for working with flowR, including the dataflow step.
 * See the {@link DEFAULT_SLICING_PIPELINE} for the pipeline with slicing and reconstructing steps
 */
export const DEFAULT_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW);
export const TREE_SITTER_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW);

function executorFor<P extends Pipeline>(parser: KnownParser, rShell: P, treeSitter: Pipeline, inputs: Omit<PipelineInput<P>, 'parser'>): PipelineExecutor<P> {
	return new PipelineExecutor((parser.name === ParserName.TreeSitter ? treeSitter : rShell) as P, { parser: parser as Parser<string>, ...inputs } as PipelineInput<P>);
}

export function createSlicePipeline(parser: TreeSitterExecutor, inputs: Omit<PipelineInput<typeof DEFAULT_SLICING_PIPELINE>, 'parser'>): PipelineExecutor<typeof TREE_SITTER_SLICING_PIPELINE>;
export function createSlicePipeline(parser: RShell, inputs: Omit<PipelineInput<typeof DEFAULT_SLICING_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_SLICING_PIPELINE>;
export function createSlicePipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_SLICING_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_SLICING_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_SLICING_PIPELINE>;
/**
 * **Please use {@link FlowrAnalyzer} instead of this directly unless you really know what you are doing.**
 * Returns either a {@link DEFAULT_SLICING_PIPELINE} or a {@link TREE_SITTER_SLICING_PIPELINE} depending on the parser used.
 * @see {@link createDataflowPipeline}
 */
export function createSlicePipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_SLICING_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_SLICING_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_SLICING_PIPELINE> {
	return executorFor(parser, DEFAULT_SLICING_PIPELINE, TREE_SITTER_SLICING_PIPELINE, inputs);
}

export function createDataflowPipeline(parser: TreeSitterExecutor, inputs: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser'>): PipelineExecutor<typeof TREE_SITTER_DATAFLOW_PIPELINE>;
export function createDataflowPipeline(parser: RShell, inputs: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_DATAFLOW_PIPELINE>;
export function createDataflowPipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_DATAFLOW_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_DATAFLOW_PIPELINE>;
/**
 * **Please use {@link FlowrAnalyzer} instead of this directly unless you really know what you are doing.**
 * Returns either a {@link DEFAULT_DATAFLOW_PIPELINE} or a {@link TREE_SITTER_DATAFLOW_PIPELINE} depending on the parser used.
 * @see {@link createSlicePipeline}
 */
export function createDataflowPipeline(parser: KnownParser, inputs: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser'>): PipelineExecutor<typeof DEFAULT_DATAFLOW_PIPELINE> | PipelineExecutor<typeof TREE_SITTER_DATAFLOW_PIPELINE> {
	return executorFor(parser, DEFAULT_DATAFLOW_PIPELINE, TREE_SITTER_DATAFLOW_PIPELINE, inputs);
}
