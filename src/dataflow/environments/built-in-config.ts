import type { BuiltInProcessorMapper, ConfigOfBuiltInMappingName } from './built-in';
import type { BuiltInEvalName } from './built-in-eval-name';
import { BuiltIns } from './built-in';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { Identifier } from './identifier';
import type { BuiltInFnInfo } from './built-in-props';
import type { Range } from 'semver';

export interface BaseBuiltInDefinition {
	/** The type of the built-in configuration */
	readonly type:             string;
	/** The function name to define to the given configuration */
	readonly names:            Identifier[];
	/** Should we assume that the value is a primitive? */
	readonly assumePrimitive?: boolean;
	/** Set when this entry deliberately re-states a name an earlier entry defines; without it a repeated name is an accident, and a test says so. */
	readonly overrides?:       boolean;
}

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
	readonly sinceVersion?: Range
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
	readonly whenArgs?:     readonly DeprecatedArgumentInformation[]
	/** Suggested replacement for this function */
	readonly replacedBy?:   string
	/** The version since this function is deprecated, if version is provided the entire function will be marked as deprecated, if the version range matches */
	readonly sinceVersion?: Range
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

/**
 * Define a built-in constant (like `NULL` or `TRUE`) and the TS value it should have
 * @template Value - The type of the constant value
 */
export interface BuiltInConstantDefinition<Value> extends BaseBuiltInDefinition {
	readonly type:  'constant';
	/** The constant value to define */
	readonly value: Value;
}

/** The config a processor accepts, `unknown` for the ones taking none (they still carry {@link BuiltInFnInfo}). */
type ConfigOfProcessor<P extends keyof typeof BuiltInProcessorMapper> = ConfigOfBuiltInMappingName<P> extends undefined ? unknown : ConfigOfBuiltInMappingName<P>;

/**
 * Define a built-in function (like `print` or `c`) and the processor to use.
 * @template BuiltInProcessor - The processor to use for this function
 */
export interface BuiltInFunctionDefinition<BuiltInProcessor extends keyof typeof BuiltInProcessorMapper> extends BaseBuiltInDefinition {
	readonly type:         'function';
	readonly processor:    BuiltInProcessor;
	readonly config?:      ConfigOfProcessor<BuiltInProcessor> & BuiltInFnInfo & { libFn?: boolean } & { deprInfo?: DeprecatedFunctionInformation };
	/** the value solver to use when folding a call to this function to a constant, see {@link BuiltInEvalHandlerMapper} */
	readonly evalHandler?: BuiltInEvalName
}

/**
 * Define a built-in replacement (like `[` or `$`) and the processor to use.
 * This is a convenience for manually combined replacement function calls.
 */
export interface BuiltInReplacementDefinition extends BaseBuiltInDefinition {
	readonly type:     'replacement';
	readonly suffixes: ('<<-' | '<-')[];
	readonly config:   BuiltInFnInfo & { readIndices: boolean, constructName?: 's7' };
}

export type BuiltInDefinition<T extends keyof typeof BuiltInProcessorMapper = keyof typeof BuiltInProcessorMapper> = BuiltInConstantDefinition<unknown> | BuiltInFunctionDefinition<T> | BuiltInReplacementDefinition;

type AnyBuiltInFunctionDefinition = { [P in keyof typeof BuiltInProcessorMapper]: BuiltInFunctionDefinition<P> }[keyof typeof BuiltInProcessorMapper];
/** Like {@link BuiltInDefinition} but one member per processor, so a config key of a foreign processor is rejected instead of silently allowed. */
export type AnyBuiltInDefinition = BuiltInConstantDefinition<unknown> | AnyBuiltInFunctionDefinition | BuiltInReplacementDefinition;
/**
 * @see DefaultBuiltinConfig
 */
export type BuiltInDefinitions<Keys extends (keyof typeof BuiltInProcessorMapper)[] = (keyof typeof BuiltInProcessorMapper)[]> = [...{ [ K in keyof Keys]: BuiltInDefinition<Keys[K]> }];

/**
 * Get the {@link BuiltIns#builtInMemory} and {@link BuiltIns#emptyBuiltInMemory} for the {@link DefaultBuiltinConfig}.
 */
export function getDefaultBuiltInDefinitions(): BuiltIns {
	const builtIns = new BuiltIns();
	for(const definition of DefaultBuiltinConfig) {
		builtIns.registerBuiltInDefinition(definition);
	}
	return builtIns;
}

/**
 * Get the {@link BuiltIns#builtInMemory} and {@link BuiltIns#emptyBuiltInMemory} for the given list of built-in definitions.
 * @param definitions  - the list of built-in definitions
 * @param loadDefaults - whether to first add the {@link DefaultBuiltinConfig} before the given {@link definitions}
 */
export function getBuiltInDefinitions<Keys extends(keyof typeof BuiltInProcessorMapper)[]>(definitions: BuiltInDefinitions<Keys>, loadDefaults: boolean | undefined): BuiltIns {
	let builtIns = new BuiltIns();

	if(loadDefaults) {
		builtIns = getDefaultBuiltInDefinitions();
	}

	for(const definition of definitions) {
		builtIns.registerBuiltInDefinition(definition);
	}

	return builtIns;
}
