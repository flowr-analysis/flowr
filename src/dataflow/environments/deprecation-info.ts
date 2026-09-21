/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 *
 * Used in {@link DeprecatedFunctionInformation} to mark a function argument as deprecated under certain conditions
 */
export interface DeprecatedArgumentInformation {
	/** Index of the argument */
	readonly argIdx?:       number,
	/** Name of the argument */
	readonly argName?:      string
	/** Only mark this argument as deprecated, if a specific value was provided */
	readonly ifValue?:      RegExp | string
	/** Suggested replacement for this argument */
	readonly replacedBy?:   string
	/** The version since this argument is deprecated */
	readonly sinceVersion?: string
	/** The state of deprecation {@link DeprecationState}, i.e. is the argument completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
}

/**
 * Information about a deprecated function
 *
 * Used in {@link DeprecatedFunctionsConfig.conditionally} to mark a function as deprecated under certain conditions
 */
export interface DeprecatedFunctionInformation {
	/**
	 * Mark specific arguments as deprecated
	 * If only whenArgs is provided, and not sinceVersion, the function is only marked as deprecated, if the argument is provided.
	 */
	readonly whenArgs?:     DeprecatedArgumentInformation[]
	/** Suggested replacement for this function */
	readonly replacedBy?:   string
	/** The version since this function is deprecated, if version is provided the entire function will be marked as deprecated, if the version range matches */
	readonly sinceVersion?: string
	/** Lifecycle State {@link DeprecationState}, i.e. is the function completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
}

export enum DeprecationState {
	/** A better alternative is available, but the function is kept (softer alternative to deprecated) {@link https://lifecycle.r-lib.org/articles/stages.html#superseded} */
	Superseded = 'superseded',
	/** A better alternative is available, and the function is marked for removal {@link https://lifecycle.r-lib.org/articles/stages.html#deprecated} */
	Deprecated = 'deprecated',
	/** No longer works and is removed and replaced by another function {@link https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Defunct} */
	Defunct = 'defunct'
}
