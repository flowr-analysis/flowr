import { initialUsedPackageInfos, usedPackages } from './features/usedPackages'
import { comments, initialCommentInfo } from './features/comments'
import { removeTokenMapQuotationMarks } from '../r-bridge/retriever'
import { definedFunctions, initialFunctionDefinitionInfo } from './features/definedFunctions'
import { initialValueInfo, values } from './features/values'
import { EvalOptions } from 'xpath-ts2/src/parse-api'
import { assignments, initialAssignmentInfo } from './features/assignments'

/**
 * A feature is something to be retrieved by the statistics.
 *
 * @typeParam T - the type of what should be collected for the feature
 */
export interface Feature<T> {
  /** a descriptive, yet unique name of the feature */
  readonly name:        string
  /** a description of the feature */
  readonly description: string
  /** a function that retrieves the feature in the document appends it to the existing feature set (we could use a monoid :D) */
  append:               (existing: T, input: Document) => T
  /** formats the given information to be consumed by a human */
  toString:             (data: T, showDetails : boolean) => string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_FEATURES: Record<string, Feature<any>> = {
  usedPackages:     usedPackages,
  comments:         comments,
  definedFunctions: definedFunctions,
  values:           values,
  assignments:      assignments
} as const

export type FeatureKey = keyof typeof ALL_FEATURES

export type FeatureStatistics = {
  [K in FeatureKey]: ReturnType<typeof ALL_FEATURES[K]['append']>
}

export const InitialFeatureStatistics: () => FeatureStatistics = () => ({
  usedPackages:     initialUsedPackageInfos(),
  comments:         initialCommentInfo(),
  definedFunctions: initialFunctionDefinitionInfo(),
  values:           initialValueInfo(),
  assignments:      initialAssignmentInfo()
})

/** just to shorten type inline hints */
export interface Query { select(options?: EvalOptions): Node[] }

export function formatMap<T>(map: Map<T, number>, details: boolean): string {
  if(details) {
    return [...map.entries()]
      .map(([key, value]) => [JSON.stringify(key), value] as [string, number])
      .sort(([s], [s2]) => s.localeCompare(s2))
      // TODO: use own
      .map(([key, value]) => `\n\t\t${removeTokenMapQuotationMarks(key)}: ${value}`)
      .join()
  } else {
    if(map.size === 0) {
      return ''
    }
    const max = Math.max(...map.values())
    const keyOfMax = [...map.entries()].find(([_, value]) => value === max)?.[0] ?? '?'
    return ` [${JSON.stringify(keyOfMax)} (${max})${map.size > 1 ? ', ...' : ''}]`
  }
}


// TODO: more advanced file provider that closes all streams in the end and keeps files open/saves checks etc.

