/**
 * Contains the default pipeline for working with flowr
 */
import { createPipeline } from './pipeline';
import { PARSE_WITH_R_SHELL_STEP } from '../all/core/00-parse';
import { NORMALIZE } from '../all/core/10-normalize';
import { STATIC_DATAFLOW } from '../all/core/20-dataflow';
import { STATIC_SLICE } from '../all/static-slicing/00-slice';
import { NAIVE_RECONSTRUCT } from '../all/static-slicing/10-reconstruct';
import { PARSE_WITH_TREE_SITTER_STEP } from '../all/core/01-parse-tree-sitter';
import { NORMALIZE_TREE_SITTER } from '../all/core/11-normalize-tree-sitter';

export const DEFAULT_SLICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE = DEFAULT_SLICING_PIPELINE;
export const DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE);
export const TREE_SITTER_SLICING_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT);
export const TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE = TREE_SITTER_SLICING_PIPELINE;

export const DEFAULT_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW);
export const TREE_SITTER_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER, STATIC_DATAFLOW);

export const DEFAULT_NORMALIZE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE);
export const TREE_SITTER_NORMALIZE_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP, NORMALIZE_TREE_SITTER);

export const DEFAULT_PARSE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP);
export const TREE_SITTER_PARSE_PIPELINE = createPipeline(PARSE_WITH_TREE_SITTER_STEP);
