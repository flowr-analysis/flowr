import type { Environment, REnvironmentInformation } from './environment';
import { Ternary } from '../../util/logic';
import { type Identifier, type IdentifierDefinition, isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';


const FunctionTargetTypes = ReferenceType.Function | ReferenceType.BuiltInFunction | ReferenceType.Unknown | ReferenceType.Argument | ReferenceType.Parameter;
const VariableTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown;
const ConstantTargetTypes = ReferenceType.Constant | ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInConstantTargetTypes = ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInFunctionTargetTypes = ReferenceType.BuiltInFunction | ReferenceType.Unknown;

const TargetTypePredicate = {
	[ReferenceType.Unknown]:         () => true,
	[ReferenceType.Function]:        ({ type }: IdentifierDefinition) => isReferenceType(type, FunctionTargetTypes),
	[ReferenceType.Variable]:        ({ type }: IdentifierDefinition) => isReferenceType(type, VariableTargetTypes),
	[ReferenceType.Constant]:        ({ type }: IdentifierDefinition) => isReferenceType(type, ConstantTargetTypes),
	[ReferenceType.Parameter]:       () => true,
	[ReferenceType.Argument]:        () => true,
	[ReferenceType.BuiltInConstant]: ({ type }: IdentifierDefinition) => isReferenceType(type, BuiltInConstantTargetTypes),
	[ReferenceType.BuiltInFunction]: ({ type }: IdentifierDefinition) => isReferenceType(type, BuiltInFunctionTargetTypes)
} as const satisfies Record<ReferenceType, (t: IdentifierDefinition) => boolean>;

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 * If the type you want to reference is unknown, please use {@link resolveByNameAnyType} instead.
 * @param name               - The name of the identifier to resolve
 * @param environment        - The current environment used for name resolution
 * @param target             - The target (meta) type of the identifier to resolve
 * @returns A list of possible identifier definitions (one if the definition location is exactly and always known), or `undefined`
 *          if the identifier is undefined in the current scope/with the current environment information.
 */
export function resolveByName(name: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	if(target === ReferenceType.Unknown) {
		return resolveByNameAnyType(name, environment);
	}
	let current: Environment = environment.current;
	let definitions: IdentifierDefinition[] | undefined = undefined;
	const wantedType = TargetTypePredicate[target];
	do{
		const definition = current.memory.get(name);
		if(definition !== undefined) {
			const filtered = definition.filter(wantedType);
			if(filtered.length === definition.length && definition.every(d => happensInEveryBranch(d.controlDependencies))) {
				return definition;
			} else if(filtered.length > 0) {
				if(definitions) {
					definitions = definitions.concat(filtered);
				} else {
					definitions = filtered;
				}
			}
		}
		current = current.parent;
	} while(!current.builtInEnv);

	const builtIns = current.memory.get(name);
	if(definitions) {
		return builtIns === undefined ? definitions : definitions.concat(builtIns);
	} else {
		return builtIns;
	}
}

/**
 * The more performant version of {@link resolveByName} when the target type is unknown.
 */
export function resolveByNameAnyType(name: Identifier, environment: REnvironmentInformation): IdentifierDefinition[] | undefined {
	let current: Environment = environment.current;
	const g = current.cache?.get(name);
	if(g !== undefined) {
		return g;
	}
	let definitions: IdentifierDefinition[] | undefined = undefined;
	do{
		const definition = current.memory.get(name);
		if(definition) {
			if(definition.every(d => happensInEveryBranch(d.controlDependencies))) {
				environment.current.cache ??= new Map();
				environment.current.cache?.set(name, definition);
				return definition;
			} else if(definition.length > 0) {
				if(definitions) {
					definitions = definitions.concat(definition);
				} else {
					definitions = definition;
				}
			}
		}
		current = current.parent;
	} while(!current.builtInEnv);

	const builtIns = current.memory.get(name);
	let ret: IdentifierDefinition[] | undefined;
	if(definitions) {
		ret = builtIns === undefined ? definitions : definitions.concat(builtIns);
	} else {
		ret = builtIns;
	}
	if(ret) {
		environment.current.cache ??= new Map();
		environment.current.cache?.set(name, ret);
	}
	return ret;
}

/**
 * Checks whether the given identifier name resolves to a built-in constant with the given value.
 * @param name               - The name of the identifier to resolve
 * @param environment        - The current environment used for name resolution
 * @param wantedValue        - The built-in constant value to check for
 * @returns Whether the identifier always, never, or maybe resolves to the given built-in constant value
 */
export function resolvesToBuiltInConstant(name: Identifier | undefined, environment: REnvironmentInformation, wantedValue: unknown): Ternary {
	if(name === undefined) {
		return Ternary.Never;
	}
	const definition = resolveByName(name, environment, ReferenceType.Constant);

	if(definition === undefined) {
		return Ternary.Never;
	}

	let all = true;
	let some = false;
	for(const def of definition) {
		if(def.type === ReferenceType.BuiltInConstant && def.value === wantedValue) {
			some = true;
		} else {
			all = false;
		}
	}

	if(all) {
		return Ternary.Always;
	} else {
		return some ? Ternary.Maybe : Ternary.Never;
	}
}
