/**
 * Contains the default pipeline for working with flowr
 */
import { createPipeline } from './pipeline'
import { PARSE_WITH_R_SHELL_STEP } from '../all/core/00-parse'
import { NORMALIZE } from '../all/core/10-normalize'
import { LEGACY_STATIC_DATAFLOW } from '../all/core/20-static-dataflow'
import { STATIC_SLICE } from '../all/static-slicing/00-slice'
import { NAIVE_RECONSTRUCT } from '../all/static-slicing/10-reconstruct'

export const DEFAULT_SLICING_PIPELINE = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE, LEGACY_STATIC_DATAFLOW, STATIC_SLICE, NAIVE_RECONSTRUCT)
