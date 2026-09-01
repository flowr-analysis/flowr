import { EnvType, type Environment, type REnvironmentInformation } from './environment';
import { Ternary } from '../../util/logic';
import { type BrandedIdentifier, Identifier, type BrandedNamespace, type IdentifierDefinition, isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import { S7DispatchSeparator } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** how many answers a frozen layer memoizes before it starts over, so the memo cannot grow without bound */
const TailCacheCap = 4096;

/** A namespaced lookup only sees its matching layer; a bare lookup skips loaded-but-unattached namespaces (`requireNamespace`). */
function layerSkipped(layer: Environment, ns: BrandedNamespace | undefined): boolean {
	if(ns !== undefined) {
		return layer.n !== ns;
	}
	return layer.t === EnvType.LoadedNamespace;
}

/**
 * What the built-in environment states about `pkg::name` for a package nothing attached: `pkg::fn` reaches its
 * package in R whether or not it is on the search path, so a namespaced name has to find it here.
 */
function statedIn(builtIn: Environment, name: BrandedIdentifier, ns: BrandedNamespace | undefined): IdentifierDefinition[] | undefined {
	return ns === undefined ? undefined : builtIn.namespaces?.get(String(ns))?.get(name);
}

const FunctionTargetTypes = ReferenceType.Function | ReferenceType.BuiltInFunction | ReferenceType.Unknown | ReferenceType.Argument | ReferenceType.Parameter;
const VariableTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown;
const ConstantTargetTypes = ReferenceType.Constant | ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInConstantTargetTypes = ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInFunctionTargetTypes = ReferenceType.BuiltInFunction | ReferenceType.Unknown;
const NonFunctionTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown
	| ReferenceType.Constant | ReferenceType.BuiltInConstant;

const inEveryBranch = (d: IdentifierDefinition) => happensInEveryBranch(d.cds);
const notAParameter = (d: IdentifierDefinition) => d.type !== ReferenceType.Parameter;

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
	[ReferenceType.NonFunction]:     ({ type }: IdentifierDefinition) => isReferenceType(type, NonFunctionTargetTypes),
} as const satisfies Record<ReferenceType, (t: IdentifierDefinition) => boolean>;

/**
 * What the script itself defines under `id`, ignoring everything flowR carries or a database attached.
 * This is the fallback of a value position ({@link ReferenceType.NonFunction}), and the two halves answer
 * the two ways a value position meets a function of its name. In a project that attaches packages,
 * `library(dplyr)` puts a function `id` in scope, and `filter(df, id > 2)` means the column, never that
 * function. A script writing `x <- function() 1` and then `x > 2` has only that one `x` to mean, wrong as
 * the comparison is, so the read stays: dropping it would leave the definition looking unused.
 */
function ownDefinitions(id: Identifier, environment: REnvironmentInformation): readonly IdentifierDefinition[] | undefined {
	const own = resolveByNameAnyType(id, environment)?.filter(d => !NodeId.isBuiltIn(d.nodeId));
	return own !== undefined && own.length > 0 ? own : undefined;
}

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 * If the type you want to reference is unknown, please use {@link resolveByNameAnyType} instead.
 * @param    id          - The identifier to resolve (optionally namespaced)
 * @param    environment - The current environment used for name resolution
 * @param    target      - The target (meta) type of the identifier to resolve
 * @returns              A list of possible identifier definitions (one if the definition location is exactly and always known), or `undefined`
 *          if the identifier is undefined in the current scope/with the current environment information.
 * @useInstead {@link Resolve.byNameAndType}
 */
export function resolveByName(id: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	if(target === ReferenceType.Unknown) {
		return resolveByNameAnyType(id, environment);
	}
	const found = resolveByTargetType(id, environment, target);
	return found === undefined && target === ReferenceType.NonFunction ? ownDefinitions(id, environment) : found;
}

/** {@link resolveByName} without its two special targets, i.e. the plain walk up the environments. */
function resolveByTargetType(id: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	/* read piecewise, `Identifier.toArray` would allocate a tuple per resolution */
	const name = Identifier.getName(id);
	const ns = Identifier.getNamespace(id);
	const internal = Identifier.accessesInternal(id);
	let current: Environment = environment.current;
	/* `current` can already be the built-in environment itself (e.g. `get(x, envir=baseenv())`);
	 * it has no parent to walk to, so resolve directly instead of entering the loop below. */
	if(current.builtInEnv) {
		return current.lookup(name);
	}
	let definitions: IdentifierDefinition[] | undefined = undefined;
	const wantedType = TargetTypePredicate[target];
	/* the attached packages below the code's own frames are a dozen layers deep and nothing writes them, so the
	 * walk through them is done once per name and target instead of once per resolution */
	const flatten = ns === undefined && internal !== false && typeof id === 'string'
		&& target !== ReferenceType.S3MethodPrefix && target !== ReferenceType.S7MethodPrefix;
	const key = flatten ? `${target}\u0000${name}` : '';
	let flattenAt: Environment | undefined;
	do{
		if(flatten && flattenAt === undefined && definitions === undefined && (current.t !== undefined || current.builtInEnv)) {
			const cached = current.tailCache?.get(key);
			if(cached !== undefined || current.tailCache?.has(key)) {
				return cached;
			}
			flattenAt = current;
		}
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
			definition = current.lookup(name);
			if(internal === false) {
				definition = definition?.filter(({ name }) => name === undefined || !Identifier.accessesInternal(name));
			}
		}
		if(definition !== undefined && definition.length > 0) {
			/* ask before filtering: the common case wants all of them and needs no copy */
			let allWanted = true;
			let allOk = true;
			const checkParameters = target === ReferenceType.Function;
			for(const def of definition) {
				if(!wantedType(def)) {
					allWanted = false;
					allOk = false;
					break;
				}
				if(allOk && ((checkParameters && !notAParameter(def)) || !inEveryBranch(def))) {
					allOk = false;
				}
			}
			if(allOk) {
				if(flattenAt !== undefined) {
					(flattenAt.tailCache ??= new Map()).set(key, definition);
				}
				return definition;
			}
			/* never alias the environment's own array, it is appended to below */
			const filtered = allWanted ? definition.slice() : definition.filter(wantedType);
			if(filtered.length > 0) {
				if(definitions) {
					definitions.push(...filtered);
				} else {
					definitions = filtered;
				}
			}
		}
		current = current.parent;
	} while(!current.builtInEnv);

	/* the built-in layer is handed over as it is, except to a value position: `filter(df, c > 2)` means the
	   column `c`, never `base::c`, and only with nothing left does `ownDefinitions` have its say */
	const known = statedIn(current, name, ns) ?? current.lookup(name);
	const builtIns = target === ReferenceType.NonFunction ? known?.filter(wantedType) : known;
	const result = definitions
		? (builtIns === undefined || builtIns.length === 0 ? definitions : definitions.concat(builtIns))
		: (builtIns === undefined || builtIns.length > 0 ? builtIns : undefined);
	if(flattenAt !== undefined) {
		const memo = flattenAt.tailCache ??= new Map();
		if(memo.size >= TailCacheCap) {
			memo.clear();
		}
		memo.set(key, result);
	}
	return result;
}

/**
 * The more performant version of {@link resolveByName} when the target type is unknown.
 * @useInstead {@link Resolve.byName}
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
	const name = Identifier.getName(id);
	const ns = Identifier.getNamespace(id);
	const internal = Identifier.accessesInternal(id);

	/* `current` can already be the built-in environment itself */
	if(current.builtInEnv) {
		const ret = current.lookup(name);
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
		let definition = current.lookup(name);
		if(definition) {
			if(internal === false) {
				definition = definition.filter(({ name }) => name === undefined || !Identifier.accessesInternal(name));
			}
			if(definition.every(inEveryBranch)) {
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

	const builtIns = statedIn(current, name, ns) ?? current.lookup(name);
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
 * Whether every definition `name` may refer to is the built-in one (or there is none), i.e., the name is not
 * shadowed by a user definition. Pass the {@link ReferenceType} the use site wants: `Function` for a call like
 * `ls()`, `Constant` for a name like `.GlobalEnv`.
 * @useInstead {@link Resolve.isBuiltIn}
 */
export function resolvesToBuiltIn(name: Identifier, environment: REnvironmentInformation, target: ReferenceType.Function | ReferenceType.Constant): boolean {
	const defs = resolveByName(name, environment, target);
	const builtIn = target === ReferenceType.Function ? ReferenceType.BuiltInFunction : ReferenceType.BuiltInConstant;
	return defs === undefined || defs.every(d => isReferenceType(d.type, builtIn));
}

/**
 * Checks whether the given identifier name resolves to a built-in constant with the given value.
 * @param    name        - The name of the identifier to resolve
 * @param    environment - The current environment used for name resolution
 * @param    wantedValue - The built-in constant value to check for
 * @returns              Whether the identifier always, never, or maybe resolves to the given built-in constant value
 * @useInstead {@link Resolve.toBuiltIn}
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
