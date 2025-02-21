/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 *
 * @module
 */
import type { Identifier, IdentifierDefinition, IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import { BuiltInMemory, EmptyBuiltInMemory } from './built-in';
import type { DataflowGraph } from '../graph/graph';
import { resolveByName } from './resolve-by-name';
import type { ControlDependency } from '../info';
import { jsonReplacer } from '../../util/json';

/**
 * Marks the reference as maybe (i.e., as controlled by a set of {@link IdentifierReference#controlDependencies|control dependencies}).
 */
export function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference {
	const node = graph.get(ref.nodeId, true);
	if(includeDefs) {
		const definitions = ref.name ? resolveByName(ref.name, environments, ref.type) : undefined;
		for(const definition of definitions ?? []) {
			if(definition.type !== ReferenceType.BuiltInFunction && definition.type !== ReferenceType.BuiltInConstant) {
				if(definition.controlDependencies && defaultCd && !definition.controlDependencies.find(c => c.id === defaultCd.id)) {
					definition.controlDependencies.push(defaultCd);
				} else {
					definition.controlDependencies = defaultCd ? [defaultCd] : [];
				}
			}
		}
	}
	if(node) {
		const [fst] = node;
		if(fst.cds && defaultCd && !fst.cds.includes(defaultCd)) {
			fst.cds.push(defaultCd);
		} else {
			fst.cds = defaultCd ? [defaultCd] : [];
		}
	}
	return { ...ref, controlDependencies: [...ref.controlDependencies ?? [], ...(defaultCd ? [defaultCd]: []) ] };
}

export function makeAllMaybe(references: readonly IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation, includeDefs: boolean, defaultCd: ControlDependency | undefined = undefined): IdentifierReference[] {
	if(references === undefined) {
		return [];
	}
	return references.map(ref => makeReferenceMaybe(ref, graph, environments, includeDefs, defaultCd));
}

export type EnvironmentMemory = Map<Identifier, IdentifierDefinition[]>

/** A single entry/scope within an {@link REnvironmentInformation} */
export interface IEnvironment {
	/** Unique and internally generated identifier -- will not be used for comparison but helps with debugging for tracking identities */
	readonly id: number
	/** Lexical parent of the environment, if any (can be manipulated by R code) */
	parent:      IEnvironment
	/** Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions */
	memory:      EnvironmentMemory
}

let environmentIdCounter = 0;

/** @see REnvironmentInformation */
export class Environment implements IEnvironment {
	readonly id = environmentIdCounter++;
	parent: IEnvironment;
	memory: Map<Identifier, IdentifierDefinition[]>;

	constructor(parent: IEnvironment) {
		this.parent = parent;
		this.memory = new Map();
	}
}

export interface WorkingDirectoryReference {
	readonly path:                string
	readonly controlDependencies: ControlDependency[] | undefined
}

/**
 * An environment describes a ({@link IEnvironment#parent|scoped}) mapping of names to their definitions ({@link EnvironmentMemory}).
 *
 * First, yes, R stores its environments differently, potentially even with another differentiation between
 * the `baseenv`, the `emptyenv`, and other default environments (see https://adv-r.hadley.nz/environments.html).
 * Yet, during the dataflow analysis, we want sometimes to know more (static {@link IdentifierDefinition|reference information})
 * and sometimes know less (to be honest, we do not want that,
 * but statically determining all attached environments is theoretically impossible --- consider attachments by user input).
 *
 * One important environment is the {@link BuiltInEnvironment} which contains the default definitions for R's built-in functions and constants.
 * Please use {@link initializeCleanEnvironments} to initialize the environments (which includes the built-ins).
 * During serialization, you may want to rely on the {@link builtInEnvJsonReplacer} to avoid the huge built-in environment.
 *
 *
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
	readonly current:          IEnvironment
	/** the state of currently possible working directories, and the control dependencies influencing this */
	readonly workingDirectory: string[]
	/** nesting level of the environment, will be `0` for the global/root environment */
	readonly level:            number
}


/**
 * The built-in {@link REnvironmentInformation|environment} is the root of all environments.
 *
 * For its default content (when not overwritten by a flowR config),
 * see the {@link DefaultBuiltinConfig}.
 */
export const BuiltInEnvironment = new Environment(undefined as unknown as IEnvironment);
BuiltInEnvironment.memory = undefined as unknown as EnvironmentMemory;

/**
 * The twin of the {@link BuiltInEnvironment} but with less built ins defined for
 * cases in which we want some commonly overwritten variables to remain open.
 * If you do not know if you need the empty environment, you do not need the empty environment (right now).
 *
 * @see {@link BuiltInEnvironment}
 */
export const EmptyBuiltInEnvironment: IEnvironment = {
	id:     BuiltInEnvironment.id,
	memory: undefined as unknown as EnvironmentMemory,
	parent: undefined as unknown as IEnvironment
};

/**
 * Initialize a new {@link REnvironmentInformation|environment} with the built-ins.
 * See {@link EmptyBuiltInEnvironment} for the case `fullBuiltIns = false`.
 */
export function initializeCleanEnvironments(fullBuiltIns = true): REnvironmentInformation {
	BuiltInEnvironment.memory ??= BuiltInMemory;
	EmptyBuiltInEnvironment.memory ??= EmptyBuiltInMemory;
	return {
		current: new Environment(fullBuiltIns ? BuiltInEnvironment : EmptyBuiltInEnvironment),
		level:   0
	};
}

/**
 * Helps to serialize an environment, but replaces the built-in environment with a placeholder.
 */
export function builtInEnvJsonReplacer(k: unknown, v: unknown): unknown {
	if(v === BuiltInEnvironment) {
		return '<BuiltInEnvironment>';
	} else if(v === EmptyBuiltInEnvironment) {
		return '<EmptyBuiltInEnvironment>';
	} else {
		return jsonReplacer(k, v);
	}
}


