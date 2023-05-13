import { initialUsedPackageInfos, usedPackages } from './supported/usedPackages'
import { comments, initialCommentInfo } from './supported/comments'
import { definedFunctions, initialFunctionDefinitionInfo } from './supported/definedFunctions'
import { initialValueInfo, values } from './supported/values'
import { EvalOptions } from 'xpath-ts2/src/parse-api'
import { assignments, initialAssignmentInfo } from './supported/assignments'
import { MergeableRecord } from '../../util/objects'
import { initialFunctionUsageInfo, usedFunctions } from './supported/usedFunctions'
import { initialLoopInfo, loops } from './supported/loops'
import { controlflow, initialControlflowInfo } from './supported/controlflow'
import { dataAccess, initialDataAccessInfo } from './supported/dataAccess'

/**
 * Maps each sub-feature name to the number of occurrences of that sub-feature.
 * Allows for one nesting level to denote hierarchical features. [TODO: | Record\<string, number\>]
 * <p>
 * Since we are writing to files {@link process}, we only count feature occurrences (some feature/parts are not written to file)
 */
export type FeatureInfo = Record<string, number> & MergeableRecord

/**
 * A feature is something to be retrieved by the statistics.
 *
 * @typeParam T - the type of what should be collected for the feature
 */
export interface Feature<T extends FeatureInfo> {
  /** a descriptive, yet unique name of the feature */
  readonly name:        string
  /** a description of the feature */
  readonly description: string
  /** a function that retrieves the feature in the document appends it to the existing feature set (we could use a monoid :D), the filepath corresponds to the active file (if any) */
  process:              (existing: T, input: Document, filepath: string | undefined) => T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_FEATURES: Record<string, Feature<any>> = {
  usedPackages:     usedPackages,
  comments:         comments,
  definedFunctions: definedFunctions,
  usedFunctions:    usedFunctions,
  values:           values,
  assignments:      assignments,
  loops:            loops,
  controlflow:      controlflow,
  dataAccess:       dataAccess
} as const

export type FeatureKey = keyof typeof ALL_FEATURES
export const allFeatureNames: FeatureKey[] = Object.keys(ALL_FEATURES)

export type FeatureStatistics = {
  [K in FeatureKey]: FeatureInfo
}

/**
 * while we could use these to generate the corresponding types automatically, i wanted to have the types and comments in one place
 */
export const InitialFeatureStatistics: () => FeatureStatistics = () => ({
  usedPackages:     initialUsedPackageInfos(),
  comments:         initialCommentInfo(),
  definedFunctions: initialFunctionDefinitionInfo(),
  values:           initialValueInfo(),
  assignments:      initialAssignmentInfo(),
  usedFunctions:    initialFunctionUsageInfo(),
  loops:            initialLoopInfo(),
  controlflow:      initialControlflowInfo(),
  dataAccess:       initialDataAccessInfo()
})

/** just to shorten type inline hints */
export interface Query { select(options?: EvalOptions): Node[] }



// TODO: more advanced file provider that closes all streams in the end and keeps files open/saves checks etc.

