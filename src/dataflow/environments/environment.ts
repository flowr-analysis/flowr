/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { jsonReplacer } from '../../util/json';
import type { BuiltInMemory } from './built-in';
import type { Identifier, IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';
import { guard } from '../../util/assert';
import type { ControlDependency } from '../info';
import { happensInEveryBranch } from '../info';
import type { FlowrConfigOptions } from '../../config';
import { mergeDefinitionsForPointer } from './define';
import { uniqueMergeValuesInDefinitions } from './append';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

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

type Jsonified = { id: NodeId, parent: Jsonified | undefined, builtInEnv?: true, memory: BuiltInMemory };

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
	// TODO: mae cache filer sensitive
	cache?:      BuiltInMemory;
	// TODO: maybe also cache all known names in general as a count map/bag/ref counter to allow for remove etc. to work with cache invalidation
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

	/**
	 * Create a deep clone of this environment.
	 * @param recurseParents     - Whether to also clone parent environments
	 * @see {@link shallowClone} - to create a shallow clone of this environment
	 */
	public clone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const parent = recurseParents ? this.parent.clone(recurseParents) : this.parent;
		const clone = new Environment(parent, this.builtInEnv);
		clone.cache = this.cache ? new Map(this.cache) : undefined;
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

	/**
	 * Create a shallow clone of this environment.
	 * @param recurseParents - Whether to also clone parent environments
	 * @see {@link clone}    - to create a deep clone of this environment
	 */
	public shallowClone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const parent = recurseParents ? this.parent.shallowClone(recurseParents) : this.parent;
		const clone = new Environment(parent, this.builtInEnv);
		clone.memory = new Map(this.memory);
		clone.cache = this.cache ? new Map(this.cache) : undefined;
		return clone;
	}

	/**
	 * Define a new identifier definition within this environment.
	 * @param definition  - The definition to add.
	 * @param superAssign - Whether to perform a super assignment (i.e., update an existing definition in a parent environment).
	 * @param config      - The flowr configuration options.
	 */
	public define(definition: IdentifierDefinition & { name: Identifier }, superAssign: boolean | undefined, config: FlowrConfigOptions): Environment {
		const { name } = definition;
		let newEnvironment;
		if(superAssign) {
			newEnvironment = this.clone(true);
			let current = newEnvironment;
			let last = undefined;
			let found = false;
			do{
				if(current.memory.has(name)) {
					current.memory.set(name, [definition]);
					current.cache ??= new Map();
					current.cache.set(name, [definition]);
					found = true;
					break;
				}
				last = current;
				current = current.parent;
			} while(!current.builtInEnv);
			if(!found) {
				guard(last !== undefined, () => `Could not find global scope for ${name}`);
				last.memory.set(name, [definition]);
				last.cache ??= new Map();
				last.cache.set(name, [definition]);
			}
		} else {
			newEnvironment = this.clone(false);
			// When there are defined indices, merge the definitions
			if(definition.controlDependencies === undefined && !config.solver.pointerTracking) {
				newEnvironment.memory.set(name, [definition]);
				newEnvironment.cache ??= new Map();
				newEnvironment.cache.set(name, [definition]);
			} else {
				const existing = newEnvironment.memory.get(name);
				const inGraphDefinition = definition as InGraphIdentifierDefinition;
				if(
					config.solver.pointerTracking &&
                    existing !== undefined &&
                    inGraphDefinition.controlDependencies === undefined
				) {
					if(inGraphDefinition.indicesCollection !== undefined) {
						const defs = mergeDefinitionsForPointer(existing, inGraphDefinition);
						newEnvironment.memory.set(name, defs);
						newEnvironment.cache ??= new Map();
						newEnvironment.cache.set(name, defs.slice());
					} else if((existing as InGraphIdentifierDefinition[])?.flatMap(i => i.indicesCollection ?? []).length > 0) {
						// When indices couldn't be resolved, but indices where defined before, just add the definition
						existing.push(definition);
						newEnvironment.cache ??= new Map();
						newEnvironment.cache.set(name, existing.slice());
					}
				} else if(existing === undefined || definition.controlDependencies === undefined) {
					newEnvironment.memory.set(name, [definition]);
					newEnvironment.cache ??= new Map();
					newEnvironment.cache.set(name, [definition]);
				} else {
					existing.push(definition);
					newEnvironment.cache ??= new Map();
					newEnvironment.cache.set(name, existing.slice());
				}
			}
		}
		return newEnvironment;
	}

	/**
	 * Assumes, that all definitions within other replace those within this environment (given the same name).
	 * <b>But</b> if all definitions within other are maybe, then they are appended to the current definitions (updating them to be `maybe` from now on as well), similar to {@link appendEnvironment}.
	 * This always recurses parents.
	 */
	public overwrite(other: Environment | undefined, applyCds?: readonly ControlDependency[]): Environment {
		if(!other || this.builtInEnv) {
			return this;
		}
		const map = new Map(this.memory);
		for(const [key, values] of other.memory) {
			const hasMaybe = applyCds === undefined ? values.length === 0 || values.some(v => v.controlDependencies !== undefined) : true;
			if(hasMaybe) {
				const old = map.get(key);
				// we need to make a copy to avoid side effects for old reference in other environments
				const updatedOld: IdentifierDefinition[] = old?.slice() ?? [];
				for(const v of values) {
					const index = updatedOld.findIndex(o => o.nodeId === v.nodeId && o.definedAt === v.definedAt);
					if(index >= 0) {
						continue;
					}
					if(applyCds === undefined) {
						updatedOld.push(v);
					} else {
						updatedOld.push({
							...v,
							controlDependencies: v.controlDependencies ? applyCds.concat(v.controlDependencies) : applyCds.slice()
						});
					}
				}
				map.set(key, updatedOld);
			} else {
				map.set(key, values);
			}
		}

		const out = new Environment(this.parent.overwrite(other.parent, applyCds));
		out.memory = map;
		return out;
	}

	/**
	 * Adds all writes of `other` to this environment (i.e., the operations of `other` *might* happen).
	 * This always recurses parents.
	 */
	public append(other: Environment | undefined): Environment {
		if(!other || this.builtInEnv) {
			return this;
		}
		const map = new Map(this.memory);
		for(const [key, value] of other.memory) {
			const old = map.get(key);
			if(old) {
				map.set(key, uniqueMergeValuesInDefinitions(old, value));
			} else {
				map.set(key, value);
			}
		}

		const out = new Environment(this.parent.append(other.parent));
		out.memory = map;
		return out;
	}

	public remove(name: Identifier) {
		if(this.builtInEnv) {
			return this;
		}
		const definition = this.memory.get(name);
		let cont = true;
		if(definition !== undefined) {
			this.memory.delete(name);
			this.cache?.delete(name);
			cont = !definition.every(d => happensInEveryBranch(d.controlDependencies));
		}
		if(cont) {
			this.parent.remove(name);
		}

		return this;
	}

	public removeAll(names: readonly { name: Identifier }[]) {
		if(this.builtInEnv || names.length === 0) {
			return this;
		}
		const newEnv = this.clone(true);
		// we should optimize this later
		for(const { name } of names) {
			newEnv.remove(name);
		}
		return newEnv;
	}

	toJSON(): Jsonified {
		return this.builtInEnv ? {
			id:         this.id,
			parent:     this.parent,
			builtInEnv: this.builtInEnv,
			memory:     this.memory,
		} : {
			id:     this.id,
			parent: this.parent,
			memory: this.memory,
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


