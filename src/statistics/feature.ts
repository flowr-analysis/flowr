import { initialUsedPackageInfos, usedPackages } from './features/usedPackages'

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
}

export const ALL_FEATURES = {
  usedPackages: usedPackages,
} as const

export type FeatureStatistics = {
  [K in keyof typeof ALL_FEATURES]: ReturnType<typeof ALL_FEATURES[K]['append']>
}

export const InitialFeatureStatistics: () => FeatureStatistics = () => ({
  usedPackages: initialUsedPackageInfos()
})
