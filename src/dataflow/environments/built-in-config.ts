import { type BuiltInMappingName, type ConfigOfBuiltInMappingName , BuiltIns } from './built-in';
import type { Identifier } from './identifier';
import { DefaultBuiltinConfig } from './default-builtin-config';

export interface BaseBuiltInDefinition {
    /** The type of the built-in configuration */
    readonly type:             string;
    /** The function name to define to the given configuration */
    readonly names:            Identifier[];
    /** Should we assume that the value is a primitive? */
    readonly assumePrimitive?: boolean;
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

/**
 * Define a built-in function (like `print` or `c`) and the processor to use.
 * @template BuiltInProcessor - The processor to use for this function
 */
export interface BuiltInFunctionDefinition<BuiltInProcessor extends BuiltInMappingName> extends BaseBuiltInDefinition {
    readonly type:      'function';
    readonly processor: BuiltInProcessor;
    readonly config?:   ConfigOfBuiltInMappingName<BuiltInProcessor>;
	readonly evalHandler?: string
}

/**
 * Define a built-in replacement (like `[` or `$`) and the processor to use.
 * This is a convenience for manually combined function calls with `builtin:replacement`.
 */
export interface BuiltInReplacementDefinition extends BaseBuiltInDefinition {
    readonly type:     'replacement';
    readonly suffixes: ('<<-' | '<-')[];
	readonly config:      { readIndices: boolean }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type BuiltInDefinition = BuiltInConstantDefinition<any> | BuiltInFunctionDefinition<any> | BuiltInReplacementDefinition;
/**
 * @see DefaultBuiltinConfig
 */
export type BuiltInDefinitions = BuiltInDefinition[];


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
 * @param definitions - the list of built-in definitions
 * @param loadDefaults - whether to first add the {@link DefaultBuiltinConfig} before the given {@link definitions}
 */
export function getBuiltInDefinitions(definitions: BuiltInDefinitions, loadDefaults: boolean | undefined): BuiltIns {
	let builtIns = new BuiltIns();

	if(loadDefaults) {
		builtIns = getDefaultBuiltInDefinitions();
	}

	for(const definition of definitions) {
		builtIns.registerBuiltInDefinition(definition);
	}

	return builtIns;
}
