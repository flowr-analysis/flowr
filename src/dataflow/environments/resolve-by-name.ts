import { EnvType, type Environment, REnvironment, type REnvironmentInformation } from './environment';
import { Ternary } from '../../util/logic';
import { type BrandedIdentifier, Identifier, type BrandedNamespace, type IdentifierDefinition, type IdentifierReference, isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import { S7DispatchSeparator } from '../internal/process/functions/call/built-in/built-in-s-seven-dispatch';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isBaseRPackage } from '../../util/r-base-packages';

/** how many answers a frozen layer memoizes before it starts over, so the memo cannot grow without bound */
const TailCacheCap = 4096;

/** A namespaced lookup only sees its matching layer; a bare lookup skips loaded-but-unattached namespaces (`requireNamespace`). */
function layerSkipped(layer: Environment, ns: BrandedNamespace | undefined): boolean {
	return ns !== undefined ? layer.n !== ns : layer.t === EnvType.LoadedNamespace;
}

/** What the built-in environment states about `pkg::name` for a package nothing attached: `pkg::fn` reaches its package in R whether or not it is on the search path, so a namespaced name has to find it here. */
function statedIn(builtIn: Environment, name: BrandedIdentifier, ns: BrandedNamespace | undefined): IdentifierDefinition[] | undefined {
	const stated = ns === undefined ? undefined : builtIn.namespaces?.get(String(ns))?.get(name);
	if(stated !== undefined || ns === undefined || isBaseRPackage(String(ns))) {
		return stated ?? builtIn.lookup(name);
	}
	const foreign = builtIn.lookup(name)?.filter(d => !isBaseRPackage(String(d.name === undefined ? undefined : Identifier.getNamespace(d.name))));
	return foreign?.length ? foreign : undefined;
}

const FunctionTargetTypes = ReferenceType.Function | ReferenceType.BuiltInFunction | ReferenceType.Unknown | ReferenceType.Argument | ReferenceType.Parameter;
const VariableTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown;
const ConstantTargetTypes = ReferenceType.Constant | ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInConstantTargetTypes = ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInFunctionTargetTypes = ReferenceType.BuiltInFunction | ReferenceType.Unknown;
const NonFunctionTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown
	| ReferenceType.Constant | ReferenceType.BuiltInConstant;

const inEveryBranch = (d: IdentifierDefinition) => happensInEveryBranch(d.cds);

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

/** What the script itself defines under `id`, ignoring everything flowR carries or a database attached. */
function ownDefinitions(id: Identifier, environment: REnvironmentInformation): readonly IdentifierDefinition[] | undefined {
	const own = resolveByNameAnyType(id, environment)?.filter(d => !NodeId.isBuiltIn(d.nodeId));
	return own !== undefined && own.length > 0 ? own : undefined;
}

/** The environment the reference `ref` resolves in: the global one for a read evaluated there, `env` otherwise. */
export function scopeOf(ref: Pick<IdentifierReference, 'global'>, env: REnvironmentInformation): REnvironmentInformation {
	return ref.global ? { current: REnvironment.findGlobal(env.current), level: 0 } : env;
}

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 * @useInstead {@link Resolve.byNameAndType}
 */
export function resolveByName(id: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	if(target === ReferenceType.Unknown) {
		return resolveByNameAnyType(id, environment);
	}
	const found = resolveByTargetType(id, environment, target);
	return found === undefined && target === ReferenceType.NonFunction ? ownDefinitions(id, environment) : found;
}

function tailCacheOf(env: Environment, target: ReferenceType): Map<string, readonly IdentifierDefinition[] | undefined> {
	env.tailCache ??= new Map();
	let memo = env.tailCache.get(target);
	if(memo === undefined) {
		env.tailCache.set(target, memo = new Map<string, readonly IdentifierDefinition[] | undefined>());
	}
	return memo;
}

/** {@link resolveByName} without its two special targets, i.e. the plain walk up the environments. */
function resolveByTargetType(id: Identifier, environment: REnvironmentInformation, target: ReferenceType): readonly IdentifierDefinition[] | undefined {
	/* read piecewise, `Identifier.toArray` would allocate a tuple per resolution */
	const name = Identifier.getName(id);
	const ns = Identifier.getNamespace(id);
	const internal = Identifier.accessesInternal(id);
	let current: Environment = environment.current;
	/* `current` can already be the built-in environment itself (e.g. `get(x, envir=baseenv())`); it has no parent to walk to, so resolve directly instead of entering the loop below. */
	if(current.builtInEnv) {
		return current.lookup(name);
	}
	let definitions: IdentifierDefinition[] | undefined = undefined;
	const wantedType = TargetTypePredicate[target];
	/* the attached packages below the code's own frames are a dozen layers deep and nothing writes them, so the walk through them is done once per name and target instead of once per resolution */
	const flatten = ns === undefined && internal !== false && typeof id === 'string'
		&& target !== ReferenceType.S3MethodPrefix && target !== ReferenceType.S7MethodPrefix;
	let flattenAt: Environment | undefined;
	do{
		if(flatten && flattenAt === undefined && definitions === undefined && (current.t !== undefined || current.builtInEnv)) {
			const memo = current.tailCache?.get(target);
			const cached = memo?.get(name);
			if(cached !== undefined || memo?.has(name)) {
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
			definition = current.memory.entries().filter(([defName]) => defName.startsWith(prefix)).flatMap(([, defs]) => defs).toArray();
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
				if(allOk && ((checkParameters && def.type === ReferenceType.Parameter) || !inEveryBranch(def))) {
					allOk = false;
				}
			}
			if(allOk) {
				/* a definite definition ends the walk, the maybe ones above it still count */
				const result = definitions ? definitions.concat(definition) : definition;
				if(flattenAt !== undefined) {
					tailCacheOf(flattenAt, target).set(name, result);
				}
				return result;
			}
			const filtered = allWanted ? definition : definition.filter(wantedType);
			if(filtered.length > 0) {
				(definitions ??= []).push(...filtered);
			}
		}
		current = current.parent;
	} while(!current.builtInEnv);

	/* the built-in layer is handed over as it is, except to a value position: `filter(df, c > 2)` means the column `c`, never `base::c`, and only with nothing left does `ownDefinitions` have its say */
	const known = statedIn(current, name, ns);
	const builtIns = target === ReferenceType.NonFunction ? known?.filter(wantedType) : known;
	const result = definitions
		? (builtIns === undefined || builtIns.length === 0 ? definitions : definitions.concat(builtIns))
		: (builtIns === undefined || builtIns.length > 0 ? builtIns : undefined);
	if(flattenAt !== undefined) {
		const memo = tailCacheOf(flattenAt, target);
		if(memo.size >= TailCacheCap) {
			memo.clear();
		}
		memo.set(name, result);
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
	if(typeof id === 'string') {
		const g = current.cache?.get(id);
		if(g !== undefined) {
			return g;
		}
	}
	const name = Identifier.getName(id);
	/* `current` can already be the built-in environment itself */
	if(current.builtInEnv) {
		return remember(environment, id, current.lookup(name));
	}
	const ns = Identifier.getNamespace(id);
	const internal = Identifier.accessesInternal(id);
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
				return remember(environment, id, definitions ? definitions.concat(definition) : definition);
			} else if(definition.length > 0) {
				definitions = definitions ? definitions.concat(definition) : definition;
			}
		}
		current = current.parent;
	} while(!current.builtInEnv);
	const builtIns = statedIn(current, name, ns);
	if(definitions === undefined) {
		return remember(environment, id, builtIns);
	}
	return remember(environment, id, builtIns === undefined ? definitions : definitions.concat(builtIns));
}

function remember(environment: REnvironmentInformation, id: Identifier, definitions: IdentifierDefinition[] | undefined): IdentifierDefinition[] | undefined {
	if(definitions !== undefined && typeof id === 'string') {
		(environment.current.cache ??= new Map()).set(id, definitions);
	}
	return definitions;
}

/**
 * Whether every definition `name` may refer to is the built-in one (or there is none), i.e., the name is not shadowed by a user definition.
 * @useInstead {@link Resolve.isBuiltIn}
 */
export function resolvesToBuiltIn(name: Identifier, environment: REnvironmentInformation, target: ReferenceType.Function | ReferenceType.Constant): boolean {
	const defs = resolveByName(name, environment, target);
	const builtIn = target === ReferenceType.Function ? ReferenceType.BuiltInFunction : ReferenceType.BuiltInConstant;
	return defs === undefined || defs.every(d => isReferenceType(d.type, builtIn));
}

/**
 * Checks whether the given identifier name resolves to a built-in constant with the given value.
 * @useInstead {@link Resolve.toBuiltIn}
 */
export function resolvesToBuiltInConstant(name: Identifier | undefined, environment: REnvironmentInformation, wantedValue: unknown): Ternary {
	const definition = name === undefined ? undefined : resolveByName(name, environment, ReferenceType.Constant);
	if(definition === undefined) {
		return Ternary.Never;
	}
	const isWanted = (def: IdentifierDefinition) => def.type === ReferenceType.BuiltInConstant && def.value === wantedValue;
	if(definition.every(isWanted)) {
		return Ternary.Always;
	}
	return definition.some(isWanted) ? Ternary.Maybe : Ternary.Never;
}
