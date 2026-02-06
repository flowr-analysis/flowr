import type { BuiltInProcessorMapper, ConfigOfBuiltInMappingName } from './built-in';
import { BuiltIns } from './built-in';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { Identifier } from './identifier';

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
export interface BuiltInFunctionDefinition<BuiltInProcessor extends keyof typeof BuiltInProcessorMapper> extends BaseBuiltInDefinition {
	readonly type:         'function';
	readonly processor:    BuiltInProcessor;
	readonly config?:      ConfigOfBuiltInMappingName<BuiltInProcessor> & { libFn?: boolean };
	readonly evalHandler?: string
}

/**
 * Define a built-in replacement (like `[` or `$`) and the processor to use.
 * This is a convenience for manually combined replacement function calls.
 */
export interface BuiltInReplacementDefinition extends BaseBuiltInDefinition {
	readonly type:     'replacement';
	readonly suffixes: ('<<-' | '<-')[];
	readonly config:   { readIndices: boolean, constructName?: 's7' };
}

export type BuiltInDefinition<T extends keyof typeof BuiltInProcessorMapper = keyof typeof BuiltInProcessorMapper> = BuiltInConstantDefinition<unknown> | BuiltInFunctionDefinition<T> | BuiltInReplacementDefinition;
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
		builtIns.registerBuiltInDefinition(definition as BuiltInDefinition);
	}
	return builtIns;
}

/**
 * Get the {@link BuiltIns#builtInMemory} and {@link BuiltIns#emptyBuiltInMemory} for the given list of built-in definitions.
 * @param definitions - the list of built-in definitions
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
