/**
 * This module holds the definition of what a {@link Feature} that can be extracted from an R AST is.
 *
 * Furthermore, it contains the definition of all features that are known in {@link ALL_FEATURES}.
 *
 * @module
 */
import {
	assignments,
	comments,
	controlflow,
	dataAccess,
	definedFunctions, expressionList,
	loops,
	usedFunctions,
	usedPackages,
	values
} from './supported'
import { EvalOptions } from 'xpath-ts2/src/parse-api'
import { MergeableRecord } from '../../util/objects'
import { NormalizedAst } from '../../r-bridge'
import { DataflowInformation } from '../../dataflow/internal/info'
import { variables } from './supported/variables'
import { StatisticsOutputFormat } from '../output'

/**
 * Maps each sub-feature name to the number of occurrences of that sub-feature.
 * Allows for one nesting level to denote hierarchical features.
 * <p>
 * Since we are writing to files {@link process}, we only count feature occurrences (some feature/parts are not written to file)
 */
export type FeatureInfo = Record<string, number> & MergeableRecord


/**
 * The information and context that a {@link FeatureProcessor} may operate in.
 */
export interface FeatureProcessorInput extends MergeableRecord {
	/** The XML Document representing the parsed (non-normalized) R AST */
	readonly parsedRAst:     Document,
	/** The R AST, after the normalization step */
	readonly normalizedRAst: NormalizedAst,
	/** The dataflow information for the given input */
	readonly dataflow:       DataflowInformation,
	/** The filepath that the document originated from (if present, may be undefined if the input was provided as text) */
	readonly filepath:       string | undefined
}

/**
 * A function that processes the analysis results of a document and returns the feature information.
 */
export type FeatureProcessor<T extends FeatureInfo> = (existing: T, input: FeatureProcessorInput) => T

/**
 * A feature is something to be retrieved by the statistics.
 *
 * @typeParam T - The type of what should be collected for the feature
 *
 * @see ALL_FEATURES
 */
export interface Feature<T extends FeatureInfo, Output = unknown> {
	/** A descriptive, yet unique name of the feature */
	readonly name:        string
	/** A description of the feature */
	readonly description: string
	/** A function that retrieves the feature in the document appends it to the existing feature set (we could use a monoid :D), the filepath corresponds to the active file (if any) */
	process:              FeatureProcessor<T>
	/**
	 * If present, this feature allows to post-process the results of the feature extraction (for the summarizer).
	 * This retrieves the root path to the given directory, and the already existing output (undefined if there is none).
	 */
	postProcess?:         (featureRoot: string, existing: Output | undefined) => Output
	/** Values to start the existing track from */
	initialValue:         T
}

/**
 * The source of truth for all features that are supported by the statistics.
 */
export const ALL_FEATURES = {
	usedPackages:     usedPackages,
	comments:         comments,
	definedFunctions: definedFunctions,
	usedFunctions:    usedFunctions,
	values:           values,
	assignments:      assignments,
	loops:            loops,
	controlflow:      controlflow,
	dataAccess:       dataAccess,
	expressionList:   expressionList,
	variables:        variables
} as const

export type FeatureKey = keyof typeof ALL_FEATURES
export type FeatureValue<K extends FeatureKey> = ReturnType<typeof ALL_FEATURES[K]['process']>

/** If the user passes `all`, this should be every feature present in {@link ALL_FEATURES} (see {@link allFeatureNames})*/
export type FeatureSelection = Set<FeatureKey>

export const allFeatureNames: Set<FeatureKey> = new Set<FeatureKey>(Object.keys(ALL_FEATURES) as FeatureKey[])

export type FeatureStatistics = {
	[K in FeatureKey]: FeatureInfo
}

export interface Query { select(options?: EvalOptions): Node[] }
