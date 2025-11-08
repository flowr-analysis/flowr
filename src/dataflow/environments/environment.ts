/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import type { IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import type { DataflowGraph } from '../graph/graph';
import { resolveByName } from './resolve-by-name';
import type { ControlDependency } from '../info';
import { jsonReplacer } from '../../util/json';
import { getDefaultBuiltInDefinitions } from './built-in-config';
import type { BuiltInMemory } from './built-in';

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference {
	if(includeDefs) {
		const definitions = ref.name ? resolveByName(ref.name, environments, ref.type) : undefined;
		for(const definition of definitions ?? []) {
			if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant) {
				if(definition.controlDependencies) {
					if(defaultCd && !definition.controlDependencies.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
						definition.controlDependencies.push(defaultCd);
					}
				} else {
					definition.controlDependencies = defaultCd ? [defaultCd] : [];
				}
			}
		}
	}
	const node = graph.getVertex(ref.nodeId, true);
	if(node) {
		if(node.cds) {
			if(defaultCd && !node.cds.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
				node.cds.push(defaultCd);
			}
		} else {
			node.cds = defaultCd ? [defaultCd] : [];
		}
	}
	if(ref.controlDependencies) {
		if(defaultCd && !ref.controlDependencies.find(c => c.id === defaultCd.id && c.when === defaultCd.when)) {
			return { ...ref, controlDependencies: (ref.controlDependencies ?? []).concat(defaultCd ? [defaultCd] : []) };
		}
	} else {
		return { ...ref, controlDependencies: ref.controlDependencies ?? (defaultCd ? [defaultCd] : []) };
	}
	return ref;
}


/**
 *
 */
export function makeAllMaybe(references: readonly IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference[] {
	return references?.map(ref => makeReferenceMaybe(ref, graph, environments, includeDefs, defaultCd)) ?? [];
}

/** A single entry/scope within an {@link REnvironmentInformation} */
export interface IEnvironment {
	/** Unique and internally generated identifier -- will not be used for comparison but helps with debugging for tracking identities */
	readonly id: number
	/** Lexical parent of the environment, if any (can be manipulated by R code) */
	parent:      IEnvironment
	/** Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions */
	memory:      BuiltInMemory
	/**
	 * Is this a built-in environment that is not allowed to change? Please use this carefully and only for the top-most envs!
	 */
	builtInEnv?: true | undefined
}

/**
 * Please use this function only if you do not know the object type.
 * Otherwise, rely on {@link IEnvironment#builtInEnv}
 */
export function isDefaultBuiltInEnvironment(obj: unknown) {
	return typeof obj === 'object' && obj !== null && ((obj as Record<string, unknown>).builtInEnv === true);
}

let environmentIdCounter = 1; // Zero is reserved for built-in environment

/** @see REnvironmentInformation */
export class Environment implements IEnvironment {
	readonly id;
	parent:      IEnvironment;
	memory:      BuiltInMemory;
	builtInEnv?: true;

	constructor(parent: IEnvironment, isBuiltInDefault: true | undefined = undefined) {
		this.id = isBuiltInDefault ? 0 : environmentIdCounter++;
		this.parent = parent;
		this.memory = new Map();
		// do not store if not needed!
		if(isBuiltInDefault) {
			this.builtInEnv = isBuiltInDefault;
		}
	}
}

export interface WorkingDirectoryReference {
	readonly path:                string
	readonly controlDependencies: ControlDependency[] | undefined
}

/**
 * An environment describes a ({@link IEnvironment#parent|scoped}) mapping of names to their definitions ({@link BuiltIns}).
 *
 * First, yes, R stores its environments differently, potentially even with another differentiation between
 * the `baseenv`, the `emptyenv`, and other default environments (see https://adv-r.hadley.nz/environments.html).
 * Yet, during the dataflow analysis, we want sometimes to know more (static {@link IdentifierDefinition|reference information})
 * and sometimes know less (to be honest, we do not want that,
 * but statically determining all attached environments is theoretically impossible --- consider attachments by user input).
 *
 * One important environment is the {@link BuiltIns|BuiltInEnvironment} which contains the default definitions for R's built-in functions and constants.
 * Please use {@link initializeCleanEnvironments} to initialize the environments (which includes the built-ins).
 * During serialization, you may want to rely on the {@link builtInEnvJsonReplacer} to avoid the huge built-in environment.
 * @see {@link define} - to define a new {@link IdentifierDefinition|identifier definition} within an environment
 * @see {@link resolveByName} - to resolve an {@link Identifier|identifier/name} to its {@link IdentifierDefinition|definitions} within an environment
 * @see {@link makeReferenceMaybe} - to attach control dependencies to a reference
 * @see {@link pushLocalEnvironment} - to create a new local scope
 * @see {@link popLocalEnvironment} - to remove the current local scope
 * @see {@link appendEnvironment} - to append an environment to the current one
 * @see {@link overwriteEnvironment} - to overwrite the definitions in the current environment with those of another one
 */
export interface REnvironmentInformation {
	/**  The currently active environment (the stack is represented by the currently active {@link IEnvironment#parent}). Environments are maintained within the dataflow graph. */
	readonly current: IEnvironment
	/** nesting level of the environment, will be `0` for the global/root environment */
	readonly level:   number
}

/**
 * Initialize a new {@link REnvironmentInformation|environment} with the built-ins.
 */
export function initializeCleanEnvironments(memory?: BuiltInMemory, fullBuiltIns = true): REnvironmentInformation {
	const builtInEnv = new Environment(undefined as unknown as IEnvironment, true);
	builtInEnv.memory = memory ?? (fullBuiltIns ? getDefaultBuiltInDefinitions().builtInMemory : getDefaultBuiltInDefinitions().emptyBuiltInMemory);

	return {
		current: new Environment(builtInEnv),
		level:   0
	};
}

/**
 * Helps to serialize an environment, but replaces the built-in environment with a placeholder.
 */
export function builtInEnvJsonReplacer(k: unknown, v: unknown): unknown {
	if(isDefaultBuiltInEnvironment(v)) {
		return '<BuiltInEnvironment>';
	} else {
		return jsonReplacer(k, v);
	}
}


