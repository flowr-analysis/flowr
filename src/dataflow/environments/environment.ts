/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { jsonReplacer } from '../../util/json';
import type { BuiltInMemory } from './built-in';
import type {
	BrandedNamespace,
	IdentifierDefinition,
	InGraphIdentifierDefinition
} from './identifier';
import { Identifier } from './identifier';
import { guard } from '../../util/assert';
import type { ControlDependency } from '../info';
import { happensInEveryBranch } from '../info';
import { uniqueMergeValuesInDefinitions } from './append';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { log } from '../../util/log';

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

export enum EnvType{
	Namespace = 'ns',
	Imports = 'imp'
}

interface Jsonified {
	id:          NodeId;
	parent:      Jsonified | undefined;
	builtInEnv?: true;
	memory:      BuiltInMemory;
	n?:          string;
	t?:          EnvType;
	globalEnv?:  true;
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
	readonly id: number;
	/** Optional name for namespaced/non-anonymous environments, please only set if you know what you are doing */
	n?:          string;
	/** to keep track if/whether environment was added as package/namespace/imports environment */
	t?:          EnvType;
	/** if created by a closure, the node id of that closure */
	private c?:  NodeId;
	parent:      Environment;
	memory:      BuiltInMemory;
	cache?:      Map<Identifier, IdentifierDefinition[]>;
	builtInEnv?: true;
	/** marks the global environment (`.GlobalEnv`); attached packages (see {@link EnvType}) live *below* it, the built-in env below them */
	globalEnv?:  true;

	constructor(parent: Environment, isBuiltInDefault: true | undefined = undefined) {
		this.id = isBuiltInDefault ? 0 : environmentIdCounter++;
		this.parent = parent;
		this.memory = new Map();
		// do not store if not needed!
		if(isBuiltInDefault) {
			this.builtInEnv = isBuiltInDefault;
		}
	}

	/** Marks this as an attached-package layer (see {@link EnvType}) for package `name`. */
	public asLibrary(name: string, type: EnvType): this {
		this.n = name;
		this.t = type;
		return this;
	}

	/** Marks this as the global environment (`.GlobalEnv`); see {@link globalEnv}. */
	public asGlobal(): this {
		this.globalEnv = true;
		return this;
	}

	/** please only use if you know what you are doing */
	public setClosureNodeId(nodeId: NodeId) {
		this.c = nodeId;
	}

	/**
	 * Provides the closure linked to this environment.
	 * This is of importance if, for example, if you want to know the function definition associated with this environment.
	 */
	public get closure(): NodeId | undefined {
		return this.c;
	}

	/**
	 * Create a clone of this environment. Definition arrays and objects are copy-on-write
	 * (never mutated in place) and hence shared with the clone.
	 * @param recurseParents     - Whether to also clone parent environments
	 */
	public clone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const parent = recurseParents ? this.parent.clone(recurseParents) : this.parent;
		const clone = new Environment(parent, this.builtInEnv);
		clone.c = this.c;
		clone.n = this.n;
		clone.t = this.t;
		clone.globalEnv = this.globalEnv;
		clone.memory = new Map(this.memory);
		return clone;
	}

	/**
	 * Define a new identifier definition within this environment.
	 * @param definition  - The definition to add.
	 */
	public define(definition: IdentifierDefinition & { name: Identifier }): Environment {
		const [name, ns] = Identifier.toArray(definition.name);
		if(ns !== undefined && this.n !== ns) {
			return this.defineInNamespace(definition, ns);
		}
		/* isolate the cds from the originating reference, which may still be updated in place */
		if(definition.cds !== undefined) {
			definition = { ...definition, cds: definition.cds.slice() };
		}
		const newEnvironment = this.clone(false);
		// When there are defined indices, merge the definitions
		if(definition.cds === undefined) {
			newEnvironment.memory.set(name, [definition]);
		} else {
			const existing = newEnvironment.memory.get(name);
			const inGraphDefinition = definition as InGraphIdentifierDefinition;
			if(
				existing !== undefined &&
                inGraphDefinition.cds === undefined
			) {
				newEnvironment.memory.set(name, [inGraphDefinition]);
			} else if(existing === undefined || definition.cds === undefined) {
				newEnvironment.memory.set(name, [definition]);
			} else {
				/* the array may be shared with clones, so replace instead of push */
				newEnvironment.memory.set(name, [...existing, definition]);
			}
		}
		return newEnvironment;
	}

	private defineInNamespace(definition: IdentifierDefinition & { name: Identifier }, ns: BrandedNamespace): Environment {
		if(this.n === ns) {
			return this.define(definition);
		}
		// navigate to parent until either before built-in or matching namespace
		const newEnvironment = this.clone(false);
		let current = newEnvironment;
		do{
			if(current.n === ns) {
				current.define(definition);
				return newEnvironment;
			} else if(current.parent && !current.parent.builtInEnv) {
				// clone parent
				current.parent = current.parent.clone(false);
				current = current.parent;
			} else {
				break;
			}
		} while(current.n !== ns);
		// we did not find the namespace, so we inject a new environment here
		log.warn(`Defining ${Identifier.getName(definition.name)} in namespace ${ns}, which did not exist yet in the environment chain => create (r should fail or we miss attachment).`);
		const env = new Environment(current.parent);
		env.n = ns;
		current.parent = env.define(definition);
		return newEnvironment;
	}

	public defineSuper(definition: IdentifierDefinition & { name: Identifier }): Environment {
		const [name, ns] = Identifier.toArray(definition.name);
		/* isolate the cds from the originating reference, see {@link define} */
		if(definition.cds !== undefined) {
			definition = { ...definition, cds: definition.cds.slice() };
		}
		const newEnvironment = this.clone(false);
		if(ns !== undefined && this.n !== ns) {
			newEnvironment.parent = newEnvironment.parent.defineInNamespace(definition, ns);
			return newEnvironment;
		}
		let current = newEnvironment;
		let last = undefined;
		let found = false;
		do{
			if(current.memory.has(name)) {
				current.memory.set(name, [definition]);
				found = true;
				break;
			}
			// R's `<<-` assigns in the global env if the name is unbound in every enclosing frame; it never writes into an attached package below global
			if(current.globalEnv) {
				current.memory.set(name, [definition]);
				found = true;
				break;
			}
			last = current;
			current.parent = current.parent.clone(false);
			current = current.parent;
		} while(!current.builtInEnv);
		if(!found) {
			guard(last !== undefined, () => `Could not find global scope for ${name}`);
			last.memory.set(name, [definition]);
		}
		return newEnvironment;
	}

	/**
	 * Assumes, that all definitions within other replace those within this environment (given the same name).
	 * <b>But</b> if all definitions within other are maybe, then they are appended to the current definitions (updating them to be `maybe` from now on as well), similar to {@link appendEnvironment}.
	 * This always recurses parents.
	 */
	public overwrite(other: Environment | undefined, applyCds?: readonly ControlDependency[]): Environment {
		if(!other || this === other) {
			return this;
		}
		// attached-package blocks (below global) are unioned, never overwritten - so a package attached in either env survives (see append)
		if(this.t !== undefined || other.t !== undefined) {
			return this.mergePackageBlocks(other);
		}
		if(this.builtInEnv || this.n !== other.n) {
			return this;
		}
		const map = new Map(this.memory);
		for(const [key, values] of other.memory) {
			const hasMaybe = applyCds === undefined ? values.length === 0 || values.some(v => v.cds !== undefined) : true;
			if(hasMaybe) {
				const old = map.get(key);
				if(!old && applyCds === undefined) {
					map.set(key, values);
					continue;
				}
				// we need to make a copy to avoid side effects for old reference in other environments
				const updated: IdentifierDefinition[] = old?.slice() ?? [];
				for(const v of values) {
					const { nodeId, definedAt } = v;
					const index = updated.find(o => o.nodeId === nodeId && o.definedAt === definedAt);
					if(index) {
						continue;
					}
					if(applyCds === undefined) {
						updated.push(v);
					} else {
						updated.push({
							...v,
							cds: v.cds ? applyCds.concat(v.cds) : applyCds.slice()
						});
					}
				}
				map.set(key, updated);
			} else {
				map.set(key, values);
			}
		}

		const out = new Environment(this.parent.overwrite(other.parent, applyCds));
		out.c = this.c;
		out.n = this.n;
		out.t = this.t;
		out.globalEnv = this.globalEnv;
		out.memory = map;
		return out;
	}

	/**
	 * Adds all writes of `other` to this environment (i.e., the operations of `other` *might* happen).
	 * This always recurses parents.
	 */
	public append(other: Environment | undefined): Environment {
		if(!other || this === other) {
			return this;
		}
		// attached-package blocks (below global) may diverge between branches (e.g. `library(a)` in one, `library(b)` in the
		// other, or one branch attaching nothing) - union them so no package is lost. Runs before the built-in guard because
		// one side's base may be the built-in env while the other still has packages to keep.
		if(this.t !== undefined || other.t !== undefined) {
			return this.mergePackageBlocks(other);
		}
		if(this.builtInEnv || this.n !== other.n) {
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
		out.n = this.n;
		out.t = this.t;
		out.globalEnv = this.globalEnv;
		out.memory = map;
		return out;
	}

	/**
	 * Unions two attached-package blocks (see {@link EnvType}) - e.g. from two branches attaching different packages -
	 * keeping every package once (memory merged for a package attached in both) and re-stacking them on the shared base below.
	 */
	private mergePackageBlocks(other: Environment): Environment {
		const [thisLayers, thisBase] = splitLibraryLayers(this);
		const [otherLayers, otherBase] = splitLibraryLayers(other);

		// collect the unique layers by name+type; a package loaded in both branches is kept once with merged memory.
		// `other` (the later write) first, so its packages end up nearest global - most recently attached is nearest (R `search()`)
		const merged = new Map<string, Environment>();
		for(const layers of [otherLayers, thisLayers]) {
			for(const layer of layers) {
				const key = `${layer.t}:${layer.n}`;
				const existing = merged.get(key);
				if(existing === undefined) {
					merged.set(key, layer.clone(false));
				} else {
					for(const [name, value] of layer.memory) {
						const old = existing.memory.get(name);
						existing.memory.set(name, old ? uniqueMergeValuesInDefinitions(old, value) : value);
					}
				}
			}
		}

		// re-stack the unique layers (in encounter order) on top of the merged shared base
		const uniqueLayers = Array.from(merged.values());
		let current = thisBase.append(otherBase);
		for(let i = uniqueLayers.length - 1; i >= 0; i--) {
			uniqueLayers[i].parent = current;
			current = uniqueLayers[i];
		}
		return current;
	}

	public remove(id: Identifier) {
		if(this.builtInEnv) {
			return this;
		}
		const [name, ns] = Identifier.toArray(id);
		if(ns !== undefined && this.n !== ns) {
			this.parent.remove(id);
			return this;
		}
		const definition = this.memory.get(name);
		let cont = true;
		if(definition !== undefined) {
			this.memory.delete(name);
			this.cache?.delete(name);
			cont = !definition.every(d => happensInEveryBranch(d.cds));
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
			id:        this.id,
			parent:    this.parent,
			memory:    this.memory,
			// markers needed to rebuild the search path after a round-trip (undefined values are dropped by JSON.stringify)
			n:         this.n,
			t:         this.t,
			globalEnv: this.globalEnv,
		};
	}
}

/** Walks up to the global environment (see {@link Environment#globalEnv}), falling back to the last non-builtin env. */
function findGlobalEnvironment(this: void, env: Environment): Environment {
	let current = env;
	while(!current.globalEnv && !current.parent.builtInEnv) {
		current = current.parent;
	}
	return current;
}

/**
 * Splices a package block (`blockTop` .. `blockBottom`) directly below the global environment, mirroring R
 * attaching a package below `.GlobalEnv` (so global bindings shadow package exports, and the most recently
 * attached package is nearest global). Returns a fresh `current`; only clones the path down to global.
 */
function attachPackageBelowGlobal(this: void, current: Environment, blockTop: Environment, blockBottom: Environment): Environment {
	const clonedCurrent = current.clone(false);
	let global = clonedCurrent;
	while(!global.globalEnv && !global.parent.builtInEnv) {
		global.parent = global.parent.clone(false);
		global = global.parent;
	}
	blockBottom.parent = global.parent; // the built-in env, or the previously attached packages
	global.parent = blockTop;
	return clonedCurrent;
}

/**
 * Helper functions for navigating and manipulating {@link REnvironmentInformation|environments} beyond the
 * {@link Environment} methods, in particular around the global environment and attached-package search path.
 */
export const REnvironment = {
	name:              'REnvironment',
	/** Walks up to the global environment (`.GlobalEnv`); see {@link findGlobalEnvironment}. */
	findGlobal:        findGlobalEnvironment,
	/** Attaches a package block below the global environment; see {@link attachPackageBelowGlobal}. */
	attachBelowGlobal: attachPackageBelowGlobal,
} as const;

/** Splits a package block (a contiguous run of attached-package layers, see {@link EnvType}) into its layers and the env below them. */
function splitLibraryLayers(env: Environment): [Environment[], Environment] {
	const layers: Environment[] = [];
	let current = env;
	while(current.t !== undefined && !current.builtInEnv) {
		layers.push(current);
		current = current.parent;
	}
	return [layers, current];
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


