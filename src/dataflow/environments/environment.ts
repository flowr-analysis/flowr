/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { jsonReplacer } from '../../util/json';
import { deserializeBuiltInMemory, serializeBuiltInMemory, type BuiltInMemory } from './built-in';
import type { Identifier, IdentifierDefinition, InGraphIdentifierDefinition } from './identifier';
import { guard } from '../../util/assert';
import type { ControlDependency } from '../info';
import { happensInEveryBranch } from '../info';
import type { FlowrConfigOptions } from '../../config';
import { mergeDefinitionsForPointer } from './define';
import { uniqueMergeValuesInDefinitions } from './append';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import * as v8 from 'v8';
import type { FlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import serialize from 'serialize-javascript';

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

	/**
	 * Create a deep clone of this environment.
	 * @param recurseParents     - Whether to also clone parent environments
	 */
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

	/**
	 * Define a new identifier definition within this environment.
	 * @param definition  - The definition to add.
	 * @param config      - The flowr configuration options.
	 */
	public define(definition: IdentifierDefinition & { name: Identifier }, { solver: { pointerTracking } }: FlowrConfigOptions): Environment {
		const { name } = definition;
		const newEnvironment = this.clone(false);
		// When there are defined indices, merge the definitions
		if(definition.controlDependencies === undefined && !pointerTracking) {
			newEnvironment.memory.set(name, [definition]);
		} else {
			const existing = newEnvironment.memory.get(name);
			const inGraphDefinition = definition as InGraphIdentifierDefinition;
			if(
				pointerTracking &&
                existing !== undefined &&
                inGraphDefinition.controlDependencies === undefined
			) {
				if(inGraphDefinition.indicesCollection !== undefined) {
					const defs = mergeDefinitionsForPointer(existing, inGraphDefinition);
					newEnvironment.memory.set(name, defs);
				} else if((existing as InGraphIdentifierDefinition[])?.flatMap(i => i.indicesCollection ?? []).length > 0) {
					// When indices couldn't be resolved, but indices where defined before, just add the definition
					existing.push(definition);
				}
			} else if(existing === undefined || definition.controlDependencies === undefined) {
				newEnvironment.memory.set(name, [definition]);
			} else {
				existing.push(definition);
			}
		}
		return newEnvironment;
	}

	public defineSuper(definition: IdentifierDefinition & { name: Identifier }): Environment {
		const { name } = definition;
		const newEnvironment = this.clone(true);
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

	public toJSON(excludeBuiltIn = false): Jsonified {
		return this.builtInEnv ? {
			id:         this.id,
			parent:     this.parent ? this.parent.toJSON(excludeBuiltIn) : undefined, // walk up the chain
			builtInEnv: this.builtInEnv,
			memory:     excludeBuiltIn ? undefined as unknown as BuiltInMemory: this.memory, // discard if this is a builtin env
		} : {
			id:     this.id,
			parent: this.parent.toJSON(excludeBuiltIn),
			memory: this.memory,
		};
	}

	public toSerializable(): Uint8Array {
		try {
			const json = this.toJSON(true);
			if(this.builtInEnv){
				// erase content, as we will restore this later
				json.memory = undefined as unknown as BuiltInMemory;
			}
            /** replace all memory with string representation */
            let current = json;
            while(current.parent){
                current.memory = serializeBuiltInMemory(current.memory) as BuiltInMemory;
                current = current.parent;
            }

			return v8.serialize(json);
		} catch(err: unknown) {
			console.warn('Failed to serialize env:', err);
			return new Uint8Array();
		}
	}

	public static fromSerializable(data: Uint8Array, ctx?: FlowrAnalyzerContext): Environment {
        if(!ctx)throw new Error('deserialization for env failed, as no ctx was provided');
		try {
			const json = v8.deserialize(data) as Jsonified;

            /** rebuild all memory */
            let current = json;
            while(current.parent){
                current.memory = deserializeBuiltInMemory(current.memory, ctx);
                current = current.parent;
            }
			return this.fromJSON(json, ctx);
		} catch(err) {
			console.warn('Failed to deserialize env:', err);
			return new Environment(undefined as unknown as Environment);
		}
	}

	public static fromJSON(json: Jsonified, ctx?: FlowrAnalyzerContext): Environment {
		if(!json){
			console.warn('Failed to deserialize env json as nothing was provided');
			return new Environment(undefined as unknown as Environment);
		}

		// handle the builtin env
		if(json.builtInEnv){
			if(!ctx){
				console.error('Failed to deserialize builtin env as no context was provided');
				return new Environment(undefined as unknown as Environment, true);
			}
			// just retrieve from FlowrAnalyzerContext -> FlowrEnvironmentContext
			return ctx.env.builtInEnvironment as Environment;
		}
		const parent = json.parent ? Environment.fromJSON(json.parent, ctx) : undefined as unknown as Environment;
		if(!parent && json.parent){
			console.warn('Env Parent could not be deserialized');
		}

		const env = new Environment(parent);
		env.memory = json.memory instanceof Map ? json.memory : new Map(json.memory);
		return env;
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

export interface SerializedREnvironmentInformation {
    readonly current: Uint8Array;
    readonly level:   number;
}

/**
 *
 */
export function toSerializedREnvironmentInformation(env: REnvironmentInformation): SerializedREnvironmentInformation {
	return {
		level:   env.level,
		current: env.current.toSerializable()
	};
}

/**
 *
 */
export function fromSerializedREnvironmentInformation(
	data: SerializedREnvironmentInformation,
	flowrContext?: FlowrAnalyzerContext
): REnvironmentInformation {
	return {
		level:   data.level,
		current: Environment.fromSerializable(data.current, flowrContext)
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

export interface EnvironmentDiff {
    isEqual: boolean;
    issues:  EnvironmentIssue[];
}

export interface EnvironmentIssue {
    path:     string;
    kind:     EnvironmentIssueType;
    comment?: string;
}

export type EnvironmentIssueType = 'type-mismatch'
                                | 'value-mismatch'
                                | 'missing-key'
                                | 'extra-key'
                                | 'map-size-mismatch'
                                | 'set-size-mismatch'
                                | 'function-found'
                                | 'builtin-mismatch';

/**
 *
 */
export function diffEnvironments(a: Environment, b: Environment): EnvironmentDiff {
	const issues: EnvironmentIssue[] = [];

	// Built-in envs must match by identity
	if(a.builtInEnv || b.builtInEnv) {
		if(a !== b) {
			issues.push({
				path: 'env',
				kind: 'builtin-mismatch'
			});
		}
		return {
			isEqual: issues.length === 0,
			issues
		};
	}

	// Compare memory
	diffDeep(a.memory, b.memory, 'memory', issues);

	// Compare parents recursively
	if(a.parent || b.parent) {
		if(!a.parent || !b.parent) {
			issues.push({
				path: 'parent',
				kind: 'value-mismatch'
			});
		} else {
			const parentDiff = diffEnvironments(a.parent, b.parent);
			issues.push(
				...parentDiff.issues.map(i => ({
					...i,
					path: `parent.${i.path}`
				}))
			);
		}
	}

	return {
		isEqual: issues.length === 0,
		issues
	};
}


function diffDeep(
	a: unknown,
	b: unknown,
	path: string,
	issues: EnvironmentIssue[]
): void {
	if(a === b) {
		return;
	}

	if(typeof a !== typeof b) {
		issues.push({ path, kind: 'type-mismatch' });
		return;
	}

	if(typeof a === 'function' || typeof b === 'function') {
		issues.push({ path, kind: 'function-found' });
		return;
	}

	if(a === null || b === null) {
		if(a !== b) {
			issues.push({ path, kind: 'value-mismatch' });
		}
		return;
	}

	if(Array.isArray(a)) {
		if(!Array.isArray(b)) {
			issues.push({ path, kind: 'type-mismatch' });
			return;
		}
		if(a.length !== b.length) {
			issues.push({ path, kind: 'value-mismatch' });
		}
		a.forEach((v, i) =>
			diffDeep(v, b[i], `${path}[${i}]`, issues)
		);
		return;
	}

	if(a instanceof Map) {
		if(!(b instanceof Map)) {
			issues.push({ path, kind: 'type-mismatch' });
			return;
		}
		if(a.size !== b.size) {
			issues.push({ path, kind: 'map-size-mismatch' });
		}
		for(const [k, v] of a) {
			if(!b.has(k)) {
				issues.push({ path: `${path}.${String(k)}`, kind: 'missing-key' });
			} else {
				diffDeep(v, b.get(k), `${path}.${String(k)}`, issues);
			}
		}
		for(const k of b.keys()) {
			if(!a.has(k)) {
				issues.push({ path: `${path}.${String(k)}`, kind: 'extra-key' });
			}
		}
		return;
	}

	if(a instanceof Set) {
		if(!(b instanceof Set)) {
			issues.push({ path, kind: 'type-mismatch' });
			return;
		}
		if(a.size !== b.size) {
			issues.push({ path, kind: 'set-size-mismatch' });
		}
		return;
	}

	if(typeof a === 'object') {
		const ak = Object.keys(a);
		const bk = Object.keys(b as object);

		for(const k of ak) {
			if(!(k in (b as object))) {
				issues.push({ path: `${path}.${k}`, kind: 'missing-key' });
			} else {
				diffDeep(
					(a as Record<string, unknown>)[k],
					(b as Record<string, unknown>)[k],
					`${path}.${k}`,
					issues
				);
			}
		}

		for(const k of bk) {
			if(!(k in (a))) {
				issues.push({ path: `${path}.${k}`, kind: 'extra-key' });
			}
		}
		return;
	}

	if(a !== b) {
		issues.push({ path, kind: 'value-mismatch' });
	}
}
