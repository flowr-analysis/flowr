import { initialUsedPackageInfos, usedPackages } from './features/usedPackages'
import { comments, initialCommentInfo } from './features/comments'
import { definedFunctions, initialFunctionDefinitionInfo } from './features/definedFunctions'
import { initialValueInfo, values } from './features/values'
import { EvalOptions } from 'xpath-ts2/src/parse-api'
import { assignments, initialAssignmentInfo } from './features/assignments'
import { MergeableRecord } from '../util/objects'
import { initialFunctionUsageInfo, usedFunctions } from './features/usedFunctions'
import { initialLoopInfo, loops } from './features/loops'
import { controlflow, initialControlflowInfo } from './features/controlflow'

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
  controlflow:      controlflow
} as const

export type FeatureKey = keyof typeof ALL_FEATURES

export type FeatureStatistics = {
  [K in FeatureKey]: FeatureInfo
}

/**
 * while e could use these to generate the corresponding types automatically, i wanted to have the types and comments in one place
 */
export const InitialFeatureStatistics: () => FeatureStatistics = () => ({
  usedPackages:     initialUsedPackageInfos(),
  comments:         initialCommentInfo(),
  definedFunctions: initialFunctionDefinitionInfo(),
  values:           initialValueInfo(),
  assignments:      initialAssignmentInfo(),
  usedFunctions:    initialFunctionUsageInfo(),
  loops:            initialLoopInfo(),
  controlflow:      initialControlflowInfo()
})

/** just to shorten type inline hints */
export interface Query { select(options?: EvalOptions): Node[] }



export function printFeatureStatistics(statistics: FeatureStatistics, features: 'all' | Set<FeatureKey> = 'all'): void {
  for(const feature of Object.keys(statistics)) {
    if(features !== 'all' && !features.has(feature)) {
      continue
    }
    const meta = ALL_FEATURES[feature]
    console.log(`\n\n-----${meta.name}-------------`)
    console.log(`\x1b[37m${meta.description}\x1b[m`)
    printFeatureStatisticsEntry(statistics[feature])
    console.log('\n\n')
  }
}

const pad = 3

function printFeatureStatisticsEntry(info: FeatureInfo): void {
  let longestKey = 0
  let longestValue = 0
  const out = new Map<string, string>()
  for(const [key, value] of Object.entries(info)) {
    if(key.length > longestKey) {
      longestKey = key.length
    }
    const valueString = value.toLocaleString()
    out.set(key, valueString)
    if(valueString.length > longestValue) {
      longestValue = valueString.length
    }
  }
  for(const [key, value] of out.entries()) {
    console.log(`${key.padEnd(longestKey + pad)} ${value.padStart(longestValue)}`)
  }
}



// TODO: more advanced file provider that closes all streams in the end and keeps files open/saves checks etc.

