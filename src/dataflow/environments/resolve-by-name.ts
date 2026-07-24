import { EnvType, type Environment, type REnvironmentInformation } from './environment';
import { Ternary } from '../../util/logic';
import { Identifier, type BrandedNamespace, type IdentifierDefinition, isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import { S7DispatchSeparator } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';

/** A namespaced lookup only sees its matching layer; a bare lookup skips loaded-but-unattached namespaces (`requireNamespace`). */
function layerSkipped(layer: Environment, ns: BrandedNamespace | undefined): boolean {
	if(ns !== undefined) {
		return layer.n !== ns;
	}
	return layer.t === EnvType.LoadedNamespace;
}

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
	[ReferenceType.BuiltInFunction]: ({ type }: IdentifierDefinition) => isReferenceType(type, BuiltInFunctionTargetTypes),
	[ReferenceType.S3MethodPrefix]:  ({ type }: IdentifierDefinition) => isReferenceType(type, FunctionTargetTypes),
	[ReferenceType.S7MethodPrefix]:  ({ type }: IdentifierDefinition) => isReferenceType(type, FunctionTargetTypes),
} as const satisfies Record<ReferenceType, (t: IdentifierDefinition) => boolean>;

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 * If the type you want to reference is unknown, please use {@link resolveByNameAnyType} instead.
 * @param id                 - The identifier to resolve (optionally namespaced)
 * @param environment        - The current environment used for name resolution
 * @param target             - The target (meta) type of the identifier to resolve
 * @returns A list of possible identifier definitions (one if the definition location is exactly and always known), or `undefined`
 *          if the identifier is undefined in the current scope/with the current environment information.
 */
export function resolveByName(id: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	if(target === ReferenceType.Unknown) {
		return resolveByNameAnyType(id, environment);
	}
	const [name, ns, internal] = Identifier.toArray(id);
	let current: Environment = environment.current;
	/* `current` can already be the built-in environment itself (e.g. `get(x, envir=baseenv())`);
	 * it has no parent to walk to, so resolve directly instead of entering the loop below. */
	if(current.builtInEnv) {
		return current.memory.get(name);
	}
	let definitions: IdentifierDefinition[] | undefined = undefined;
	const wantedType = TargetTypePredicate[target];
	do{
		if(layerSkipped(current, ns)) {
			current = current.parent;
			continue;
		}
		let definition: IdentifierDefinition[] | undefined;
		if(target === ReferenceType.S3MethodPrefix || target === ReferenceType.S7MethodPrefix) {
			// S3 method prefixes only resolve to functions, S3s must not match the exported criteria!
			const prefix = name + (target === ReferenceType.S3MethodPrefix ? '.' : S7DispatchSeparator);
			definition = current.memory.entries()
				.filter(([defName]) => defName.startsWith(prefix))
				.flatMap(([, defs]) => defs)
				.toArray();
		} else {
			definition = current.memory.get(name);
			if(internal === false) {
				definition = definition?.filter(({ name }) => name === undefined || !Identifier.accessesInternal(name));
			}
		}
		if(definition !== undefined && definition.length > 0) {
			const filtered = definition.filter(wantedType);
			if(filtered.length === definition.length && (target !== ReferenceType.Function || definition.every(d => d.type !== ReferenceType.Parameter)) && definition.every(d => happensInEveryBranch(d.cds))) {
				return definition;
			} else if(filtered.length > 0) {
				if(definitions) {
					definitions.push(...filtered);
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
export function resolveByNameAnyType(id: Identifier, environment: REnvironmentInformation): IdentifierDefinition[] | undefined {
	let current: Environment = environment.current;
	/* only cache plain names: namespaced ids are arrays (no stable map key) and must not answer plain lookups */
	const cacheable = typeof id === 'string';
	if(cacheable) {
		const g = current.cache?.get(id);
		if(g !== undefined) {
			return g;
		}
	}
	const [name, ns, internal] = Identifier.toArray(id);

	/* `current` can already be the built-in environment itself */
	if(current.builtInEnv) {
		const ret = current.memory.get(name);
		if(ret && cacheable) {
			current.cache ??= new Map();
			current.cache.set(id, ret);
		}
		return ret;
	}

	let definitions: IdentifierDefinition[] | undefined = undefined;
	do{
		if(layerSkipped(current, ns)) {
			current = current.parent;
			continue;
		}
		let definition = current.memory.get(name);
		if(definition) {
			if(internal === false) {
				definition = definition.filter(({ name }) => name === undefined || !Identifier.accessesInternal(name));
			}
			if(definition.every(d => happensInEveryBranch(d.cds))) {
				if(cacheable) {
					environment.current.cache ??= new Map();
					environment.current.cache.set(id, definition);
				}
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
	if(ret && cacheable) {
		environment.current.cache ??= new Map();
		environment.current.cache.set(id, ret);
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
