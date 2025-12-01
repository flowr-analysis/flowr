/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { jsonReplacer } from '../../util/json';
import type { BuiltInMemory } from './built-in';
import type { Identifier, IdentifierDefinition } from './identifier';
import { guard } from '../../util/assert';

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
	parent:      Environment;
	memory:      BuiltInMemory;
	cache?:      BuiltInMemory;
	builtInEnv?: true;

	constructor(parent: Environment, isBuiltInDefault: true | undefined = undefined) {
		this.id = isBuiltInDefault ? 0 : environmentIdCounter++;
		this.parent = parent;
		this.memory = new Map();
		// do not store if not needed!
		if(isBuiltInDefault) {
			this.builtInEnv = isBuiltInDefault;
		}
	}

	public clone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const parent = recurseParents ? this.parent.clone(recurseParents) : this.parent;
		const clone = new Environment(parent, this.builtInEnv);
		clone.memory = new Map(
			this.memory.entries()
				.map(([k, v]) => [k,
					v.map(s => ({
						...s,
						controlDependencies: s.controlDependencies?.slice()
					} satisfies IdentifierDefinition))
				])
		);
		return clone;
	}

	private shallowClone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const parent = recurseParents ? this.parent.shallowClone(recurseParents) : this.parent;
		const clone = new Environment(parent, this.builtInEnv);
		clone.memory = new Map(this.memory);
		return clone;
	}

	public define(definition: IdentifierDefinition & { name: Identifier }, superAssign?: boolean): REnvironmentInformation {
		const { name } = definition;
		let newEnvironment;
		if(superAssign) {
			newEnvironment = this.shallowClone(true);
			let current = newEnvironment;
			let last = undefined;
			let found = false;
			do{
				if(current.memory.has(name)) {
					current.memory.set(name, [definition]);
					found = true;
					break;
				}
				last = current;
				current = current.parent;
			} while(!current.builtInEnv);
			if(!found) {
				guard(last !== undefined, () => `Could not find global scope for ${name}`);
				last.memory.set(name, [definition]);
			}
		} else {
			newEnvironment = this.shallowClone(false);
			defInEnv(newEnvironment.current, name, definition, config);
		}
		return newEnvironment;
	}

	toJSON() {
		return {
			id:         this.id,
			parent:     this.parent.id,
			memory:     this.memory,
			builtInEnv: this.builtInEnv
		};
	}
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
 * This environment is created and provided by the {@link FlowrAnalyzerEnvironmentContext}.
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
	readonly current: Environment
	/** nesting level of the environment, will be `0` for the global/root environment */
	readonly level:   number
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


