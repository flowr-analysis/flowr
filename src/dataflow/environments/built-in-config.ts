import type {
	BuiltInMappingName,
	ConfigOfBuiltInMappingName } from './built-in';
import {
	BuiltIn,
	BuiltInMemory, BuiltInProcessorMapper,
	EmptyBuiltInMemory
} from './built-in';
import type { Identifier, IdentifierDefinition } from './identifier';
import { guard } from '../../util/assert';

/** TODO: namespace */
export interface BaseBuiltInDefinition {
    /** The type of the built-in configuration */
    readonly type:             string;
    /** The function name to define to the given configuration */
    readonly names:            readonly Identifier[];
    /** Should we assume that the value is a primitive? */
    readonly assumePrimitive?: boolean;
}

/**
 * Define a built-in constant (like `NULL` or `TRUE`) and the TS value it should have
 *
 * @template Value - The type of the constant value
 */
export interface BuiltInConstantDefinition<Value> extends BaseBuiltInDefinition {
    readonly type:  'constant';
    /** The constant value to define */
    readonly value: Value;
}

/**
 * Define a built-in function (like `print` or `c`) and the processor to use.
 *
 * @template BuiltInProcessor - The processor to use for this function
 */
export interface BuiltInFunctionDefinition<BuiltInProcessor extends BuiltInMappingName> extends BaseBuiltInDefinition {
    readonly type:      'function';
    readonly processor: BuiltInProcessor;
    readonly config:    ConfigOfBuiltInMappingName<BuiltInProcessor>
}

/**
 * Define a built-in replacement (like `[` or `$`) and the processor to use.
 * This is a convenience for manually combined function calls with `builtin:replacement`.
 */
export interface BuiltInReplacementDefinition extends BaseBuiltInDefinition {
    readonly type:     'replacement';
    readonly suffixes: readonly ('<<-' | '<-')[];
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type BuiltInDefinition = BuiltInConstantDefinition<any> | BuiltInFunctionDefinition<any> | BuiltInReplacementDefinition;
export type BuiltInDefinitions = readonly BuiltInDefinition[];

function registerBuiltInConstant<T>({ names, value, assumePrimitive }: BuiltInConstantDefinition<T>): void {
	for(const name of names) {
		guard(!BuiltInMemory.has(name), `Built-in ${name} already defined`);
		const d: IdentifierDefinition[] = [{
			kind:                'built-in-value',
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			value,
			name,
			nodeId:              BuiltIn
		}];
		BuiltInMemory.set(name, d);
		if(assumePrimitive) {
			EmptyBuiltInMemory.set(name, d);
		}
	}
}

export function registerBuiltInFunctions<BuiltInProcessor extends BuiltInMappingName>(
	{ names, processor, config, assumePrimitive }: BuiltInFunctionDefinition<BuiltInProcessor>
): void {
	const mappedProcessor = BuiltInProcessorMapper[processor];
	guard(mappedProcessor !== undefined, () => `Processor for ${processor} is undefined! Please pass a valid builtin name ${JSON.stringify(Object.keys(BuiltInProcessorMapper))}!`);
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		guard(!BuiltInMemory.has(name), `Built-in ${name} already defined`);
		const d: IdentifierDefinition[] = [{
			kind:                'built-in-function',
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
			processor:           (name, args, rootId, data) => mappedProcessor(name, args, rootId, data, config as any),
			name,
			nodeId:              BuiltIn
		}];
		BuiltInMemory.set(name, d);
		if(assumePrimitive) {
			EmptyBuiltInMemory.set(name, d);
		}
	}
}

/* registers all combinations of replacements */
export function registerReplacementFunctions(
	{ names, suffixes, assumePrimitive }: BuiltInReplacementDefinition
): void {
	const replacer = BuiltInProcessorMapper['builtin:replacement'];
	guard(replacer !== undefined, () => 'Processor for builtin:replacement is undefined!');
	for(const assignment of names) {
		for(const suffix of suffixes) {
			const effectiveName = `${assignment}${suffix}`;
			guard(!BuiltInMemory.has(effectiveName), `Built-in ${effectiveName} already defined`);
			const d: IdentifierDefinition[] = [{
				kind:                'built-in-function',
				definedAt:           BuiltIn,
				processor:           (name, args, rootId, data) => replacer(name, args, rootId, data, { makeMaybe: true, assignmentOperator: suffix }),
				name:                effectiveName,
				controlDependencies: undefined,
				nodeId:              BuiltIn
			}];
			BuiltInMemory.set(effectiveName, d);
			if(assumePrimitive) {
				EmptyBuiltInMemory.set(effectiveName, d);
			}
		}
	}
}

export function registerBuiltInDefinition(definition: BuiltInDefinition) {
	switch(definition.type) {
		case 'constant':
			return registerBuiltInConstant(definition);
		case 'function':
			return registerBuiltInFunctions(definition);
		case 'replacement':
			return registerReplacementFunctions(definition);
	}
}

export function registerBuiltInDefinitions(definitions: BuiltInDefinitions) {
	for(const definition of definitions) {
		registerBuiltInDefinition(definition);
	}
}
