import {
  assignments,
  comments,
  controlflow,
  dataAccess,
  definedFunctions,
  loops,
  usedFunctions,
  usedPackages,
  values
} from './supported'
import { EvalOptions } from 'xpath-ts2/src/parse-api'
import { MergeableRecord } from '../../util/objects'

/**
 * Maps each sub-feature name to the number of occurrences of that sub-feature.
 * Allows for one nesting level to denote hierarchical features.
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
  /** values to start the existing track from  */
  initialValue() : T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_FEATURES = {
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
export type FeatureValue<k extends FeatureKey> = ReturnType<typeof ALL_FEATURES[k]['process']>

/** If the user passes `all`, this should be every feature present in {@link ALL_FEATURES} (see {@link allFeatureNames})*/
export type FeatureSelection = Set<FeatureKey>

export const allFeatureNames: Set<FeatureKey> = new Set<FeatureKey>(Object.keys(ALL_FEATURES) as FeatureKey[])

export type FeatureStatistics = {
  [K in FeatureKey]: FeatureInfo
}

export interface Query { select(options?: EvalOptions): Node[] }



// TODO: more advanced file provider that closes all streams in the end and keeps files open/saves checks etc.

