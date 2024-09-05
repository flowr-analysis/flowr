/**
 * Contains the default pipeline for working with flowr
 */
import { createPipeline } from './pipeline'
import { PARSE_WITH_R_SHELL_STEP } from '../all/core/00-parse'
import { NORMALIZE } from '../all/core/10-normalize'
import { STATIC_DATAFLOW } from '../all/core/20-dataflow'
import { STATIC_SLICE } from '../all/static-slicing/00-slice'
import { NAIVE_RECONSTRUCT_DICED, NAIVE_RECONSTRUCT_SLICED } from '../all/static-slicing/10-reconstruct'
import { STATIC_DICE } from '../all/static-slicing/20-dicing'

export const DEFAULT_SLICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT_SLICED)
export const DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE = DEFAULT_SLICING_PIPELINE

export const DEFAULT_DICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW, STATIC_DICE, NAIVE_RECONSTRUCT_DICED)

export const DEFAULT_DATAFLOW_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, STATIC_DATAFLOW)

export const DEFAULT_NORMALIZE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE)
export const DEFAULT_PARSE_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP)
