import type { BuiltInMappingName, ConfigOfBuiltInMappingName } from './built-in';
import { builtInId, BuiltInProcessorMapper, BuiltIns } from './built-in';
import type { Identifier, IdentifierDefinition } from './identifier';
import { ReferenceType } from './identifier';
import { guard } from '../../util/assert';
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

function registerBuiltInConstant<T>({ names, value, assumePrimitive }: BuiltInConstantDefinition<T>, builtIns: BuiltIns): void {
	for(const name of names) {
		const id = builtInId(name);
		const d: IdentifierDefinition[] = [{
			type:                ReferenceType.BuiltInConstant,
			definedAt:           id,
			controlDependencies: undefined,
			value,
			name,
			nodeId:              id
		}];
		builtIns.set(name, d, assumePrimitive);
	}
}

export function registerBuiltInFunctions<BuiltInProcessor extends BuiltInMappingName>(
	{ names, processor, config, assumePrimitive }: BuiltInFunctionDefinition<BuiltInProcessor>,
	builtIns: BuiltIns
): void {
	const mappedProcessor = BuiltInProcessorMapper[processor];
	guard(mappedProcessor !== undefined, () => `Processor for ${processor} is undefined! Please pass a valid builtin name ${JSON.stringify(Object.keys(BuiltInProcessorMapper))}!`);
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const id = builtInId(name);
		const d: IdentifierDefinition[] = [{
			type:                ReferenceType.BuiltInFunction,
			definedAt:           id,
			controlDependencies: undefined,
			/* eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument */
			processor:           (name, args, rootId, data) => mappedProcessor(name, args, rootId, data, config as any),
			config,
			name,
			nodeId:              id
		}];
		builtIns.set(name, d, assumePrimitive);
	}
}

/* registers all combinations of replacements */
export function registerReplacementFunctions(
	{ names, suffixes, assumePrimitive, config }: BuiltInReplacementDefinition,
	builtIns: BuiltIns
): void {
	const replacer = BuiltInProcessorMapper['builtin:replacement'];
	guard(replacer !== undefined, () => 'Processor for builtin:replacement is undefined!');
	for(const assignment of names) {
		for(const suffix of suffixes) {
			const effectiveName = `${assignment}${suffix}`;
			const id = builtInId(effectiveName);
			const d: IdentifierDefinition[] = [{
				type:      ReferenceType.BuiltInFunction,
				definedAt: id,
				processor: (name, args, rootId, data) => replacer(name, args, rootId, data, { makeMaybe: true, assignmentOperator: suffix, readIndices: config.readIndices }),
				config:    {
					...config,
					assignmentOperator: suffix,
					makeMaybe:          true
				},
				name:                effectiveName,
				controlDependencies: undefined,
				nodeId:              id
			}];
			builtIns.set(effectiveName, d, assumePrimitive);
		}
	}
}

export function registerBuiltInDefinition(definition: BuiltInDefinition, builtIns: BuiltIns) {
	switch(definition.type) {
		case 'constant':
			return registerBuiltInConstant(definition, builtIns);
		case 'function':
			return registerBuiltInFunctions(definition, builtIns);
		case 'replacement':
			return registerReplacementFunctions(definition, builtIns);
	}
}

export function getDefaultBuiltInDefinitions(): BuiltIns {
	const builtIns = new BuiltIns();
	for(const definition of DefaultBuiltinConfig) {
		registerBuiltInDefinition(definition, builtIns);
	}
	return builtIns;
}

export function getBuiltInDefinitions(definitions: BuiltInDefinitions, loadDefaults: boolean | undefined): BuiltIns {
	let builtIns = new BuiltIns();

	if(loadDefaults) {
		builtIns = getDefaultBuiltInDefinitions();
	}

	for(const definition of definitions) {
		registerBuiltInDefinition(definition, builtIns);
	}

	return builtIns;
}
