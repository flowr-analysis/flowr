/**
 * Provides an environment structure similar to R.
 * @module
 */
import { jsonReplacer } from '../../util/json';
import type { BuiltInMemory } from './built-in';
import type {
	BrandedIdentifier,
	BrandedNamespace,
	IdentifierDefinition,
	InGraphIdentifierDefinition
} from './identifier';
import { Identifier, PkgName } from './identifier';
import { guard } from '../../util/assert';
import type { ControlDependency } from '../info';
import { happensInEveryBranch } from '../info';
import { uniqueMergeValuesInDefinitions } from './append';
import { Frame } from './frame-memory';
import type { MemoryView } from './frame-memory';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { log } from '../../util/log';

/** A single entry/scope within an {@link REnvironmentInformation} */
export interface IEnvironment {
	/** Unique internally generated identifier, used for debugging not comparison */
	readonly id: number
	/** Lexical parent of the environment, if any (can be manipulated by R code) */
	parent:      IEnvironment
	/** Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions */
	memory:      MemoryView
	/** Built-in environment that must not change; only for the top-most envs. */
	builtInEnv?: true | undefined
}

export enum EnvType {
	Namespace = 'ns',
	Imports = 'imp',
	/** `requireNamespace("pkg")`: `pkg::fn` resolves, bare `fn` does not */
	LoadedNamespace = 'lns',
	/** A package `solver.assumeAttachedPackages` states as attached; a `library()` in the analyzed code still attaches it in full over this. */
	AssumedNamespace = 'ans'
}

interface Jsonified {
	id:          NodeId;
	parent:      Jsonified | undefined;
	builtInEnv?: true;
	memory:      ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>;
	n?:          string;
	t?:          EnvType;
	globalEnv?:  true;
}

/** Use only if you do not know the object type; otherwise rely on {@link IEnvironment#builtInEnv}. */
export function isDefaultBuiltInEnvironment(obj: unknown) {
	return typeof obj === 'object' && obj !== null && ((obj as Record<string, unknown>).builtInEnv === true);
}

let environmentIdCounter = 1; // Zero is reserved for built-in environment

/** @see REnvironmentInformation */
export class Environment implements IEnvironment {
	readonly id:           number;
	/** Optional name for namespaced/non-anonymous environments, please only set if you know what you are doing */
	n?:                    string;
	/** which search-path layer this env is (package/namespace/imports), if any */
	t?:                    EnvType;
	/** if created by a closure, the node id of that closure */
	private c?:            NodeId;
	parent:                Environment;
	/** where this environment's names live; shared with every clone until one of them writes */
	private frame:         Frame;
	cache?:                Map<Identifier, IdentifierDefinition[]>;
	/** what a resolution found below this frame, by target and name; only frames nothing writes keep one */
	tailCache?:            Map<string, readonly IdentifierDefinition[] | undefined>;
	builtInEnv?:           true;
	/** {@link memory} is shared with a clone; writing needs {@link writableMemory} to unshare it first */
	private sharedMemory?: true;
	/** {@link parent} is shared with the environment this was cloned from; writing through it needs {@link writableParent} */
	private sharedParent?: true;
	/** marks the global environment (`.GlobalEnv`); attached packages (see {@link EnvType}) live below it */
	globalEnv?:            true;
	/** What the lexical frame this stands in for held when its closure was created; `<<-` binds lexically, so defining super needs this. */
	superMemory?:          MemoryView;
	/** What the configuration states about packages R does not attach on startup, by package; only the built-in env carries it (see {@link statedIn}). */
	namespaces?:           ReadonlyMap<string, BuiltInMemory>;

	constructor(parent: Environment, isBuiltInDefault: true | undefined = undefined, frame?: Frame) {
		this.id = isBuiltInDefault ? 0 : environmentIdCounter++;
		this.parent = parent;
		this.frame = frame ?? Frame.empty();
		/* a clone hands its frame in and the empty one is everybody's, so the first write forks either way */
		this.sharedMemory = true;
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

	/** Records the lexical frame this one stands in for; see {@link superMemory}. */
	public standsInFor(memory: MemoryView): this {
		this.superMemory = memory;
		return this;
	}

	/** please only use if you know what you are doing */
	public setClosureNodeId(nodeId: NodeId) {
		this.c = nodeId;
	}

	/** Provides the closure linked to this environment. */
	public get closure(): NodeId | undefined {
		return this.c;
	}

	/**
	 * The parent, unshared first when a write is about to go through it. A `clone(true)` hands out the original chain
	 *  and lets it materialize one frame at a time here, since a removal usually reaches only a frame or two.
	 */
	public get writableParent(): Environment {
		if(this.sharedParent) {
			const parent = this.parent.clone(false);
			parent.sharedParent = true;
			this.parent = parent;
			this.sharedParent = undefined;
		}
		return this.parent;
	}

	/** What this frame binds. */
	public get memory(): MemoryView {
		return this.frame;
	}

	/** Whether `other` holds the very bindings this does. */
	public sameMemoryAs(other: Environment): boolean {
		return this === other || this.frame === other.frame;
	}

	/** What `name` holds here; the chain walks of name resolution take this rather than {@link memory}. */
	public lookup(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		return this.frame.get(name);
	}

	/** Takes `map` as the bindings, sharing it until something writes. */
	public adoptMap(map: MemoryView): void {
		this.frame = Frame.of(map);
		this.sharedMemory = true;
	}

	/** {@link memory} ready to be written to. Every write goes through here, since {@link clone} shares the frame. */
	public get writableMemory(): Frame {
		this.tailCache = undefined;
		if(this.sharedMemory) {
			this.frame = this.frame.forWrite();
			this.sharedMemory = undefined;
		}
		return this.frame;
	}

	/** Clones this, sharing {@link memory} until either side writes; the cost is the same for a frame of any size. */
	public clone(recurseParents: boolean): Environment {
		if(this.builtInEnv) {
			return this; // do not clone the built-in environment
		}

		const clone = new Environment(this.parent, this.builtInEnv, this.frame);
		clone.c = this.c;
		clone.n = this.n;
		clone.t = this.t;
		clone.globalEnv = this.globalEnv;
		clone.superMemory = this.superMemory;
		clone.sharedMemory = this.sharedMemory = true;
		if(recurseParents && !this.parent.builtInEnv) {
			clone.sharedParent = true;
		}
		return clone;
	}

	/** Define a new identifier definition within this environment. */
	public define(definition: IdentifierDefinition & { name: Identifier }): Environment {
		const [name, ns] = Identifier.toArray(definition.name);
		if(ns !== undefined && this.n !== ns) {
			return this.defineInNamespace(definition, ns);
		}
		const newEnvironment = this.clone(false);
		newEnvironment.apply(name, definition);
		return newEnvironment;
	}

	/** Define several identifiers at once in a more performant fashion. */
	public defineAll(definitions: Iterable<IdentifierDefinition & { name: Identifier }>): Environment {
		let env = this.clone(false);
		for(const definition of definitions) {
			const [name, ns] = Identifier.toArray(definition.name);
			if(ns !== undefined && env.n !== ns) {
				env = env.defineInNamespace(definition, ns);
			} else {
				env.apply(name, definition);
			}
		}
		return env;
	}

	/** Only sound on an environment nobody else holds yet. */
	private apply(name: BrandedIdentifier, definition: IdentifierDefinition & { name: Identifier }): void {
		/* isolate the cds from the originating reference, which may still be updated in place */
		if(definition.cds !== undefined) {
			definition = { ...definition, cds: definition.cds.slice() };
		}
		// When there are defined indices, merge the definitions
		if(definition.cds === undefined) {
			this.writableMemory.set(name, [definition]);
		} else {
			const existing = this.lookup(name);
			const inGraphDefinition = definition as InGraphIdentifierDefinition;
			if(
				existing !== undefined &&
                inGraphDefinition.cds === undefined
			) {
				this.writableMemory.set(name, [inGraphDefinition]);
			} else if(existing === undefined || definition.cds === undefined) {
				this.writableMemory.set(name, [definition]);
			} else {
				/* the array may be shared with clones, so replace instead of push */
				this.writableMemory.set(name, [...existing, definition]);
			}
		}
	}

	private defineInNamespace(definition: IdentifierDefinition & { name: Identifier }, ns: BrandedNamespace): Environment {
		if(this.n === ns) {
			return this.define(definition);
		}
		// navigate to parent until either before built-in or matching namespace
		const newEnvironment = this.clone(false);
		let current = newEnvironment;
		/* the match has to be re-checked after every step: a post-condition on `current.n` would end the loop on
		 * the very layer it was looking for, before the body could define anything in it */
		for(;;) {
			if(current.n === ns) {
				/* every layer walked here is a fresh clone, and `apply` copies the shared memory on write,
				 * so this adds to the layer in place -- `define` would clone and the definition would be lost */
				current.apply(Identifier.getName(definition.name), definition);
				return newEnvironment;
			} else if(current.parent && !current.parent.builtInEnv) {
				// clone parent
				current.parent = current.parent.clone(false);
				current = current.parent;
			} else {
				break;
			}
		}
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
			/* `<<-` binds in the closest enclosing frame that holds the name, which for an emptied frame is what
			 * it stood in for when the closure was created (see {@link superMemory}) */
			if(current.lookup(name) !== undefined || current.superMemory?.has(name)) {
				current.writableMemory.set(name, [definition]);
				found = true;
				break;
			}
			// `<<-` falls back to the global env, never an attached package below it
			if(current.globalEnv) {
				current.writableMemory.set(name, [definition]);
				found = true;
				break;
			}
			last = current;
			current.parent = current.parent.clone(false);
			current = current.parent;
		} while(!current.builtInEnv);
		if(!found) {
			guard(last !== undefined, () => `Could not find global scope for ${name}`);
			last.writableMemory.set(name, [definition]);
		}
		return newEnvironment;
	}

	/** Definitions within `other` replace those here by name; if all of `other`'s are maybe, they are appended instead (turning existing ones maybe too). Always recurses parents. */
	public overwrite(other: Environment | undefined, applyCds?: readonly ControlDependency[]): Environment {
		if(!other || this === other) {
			return this;
		}
		const shortcut = this.mergeShortcut(other);
		if(shortcut !== undefined) {
			return shortcut;
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
					if(updated.some(o => o.nodeId === nodeId && o.definedAt === definedAt)) {
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
		out.superMemory = this.superMemory ?? other.superMemory;
		out.adoptMap(map);
		return out;
	}

	/** Adds all writes of `other` to this environment (`other`'s operations *might* happen). Always recurses parents. */
	public append(other: Environment | undefined): Environment {
		if(!other || this === other) {
			return this;
		}
		const shortcut = this.mergeShortcut(other);
		if(shortcut !== undefined) {
			return shortcut;
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
		out.c = this.c;
		out.n = this.n;
		out.t = this.t;
		out.globalEnv = this.globalEnv;
		out.superMemory = this.superMemory ?? other.superMemory;
		out.adoptMap(map);
		return out;
	}

	/**
	 * The environment a merge with `other` settles on without touching either memory, `undefined` if the
	 * memories have to be merged. Package blocks are always unioned, never overwritten or appended to.
	 */
	private mergeShortcut(other: Environment): Environment | undefined {
		if(this.t !== undefined || other.t !== undefined) {
			return this.mergePackageBlocks(other);
		}
		return this.builtInEnv || this.n !== other.n ? this : undefined;
	}

	/** Unions two attached-package blocks, keeping every package once (memory merged for a package in both). */
	private mergePackageBlocks(other: Environment): Environment {
		const [thisLayers, thisBase] = splitLibraryLayers(this);
		const [otherLayers, otherBase] = splitLibraryLayers(other);

		/*
		 * One block is the other plus the packages attached since (blocks grow at the front), so their union is
		 * the longer one and it is already in R's order: the most recently attached package is searched first,
		 * `library(a); library(b)` resolves `b` before `a`. This is the overwhelmingly common case, since every
		 * statement after a `library` call merges two environments that still hold its layers.
		 */
		const keep = layersEndWith(thisLayers, otherLayers) ? thisLayers
			: layersEndWith(otherLayers, thisLayers) ? otherLayers : undefined;
		if(keep !== undefined) {
			const base = thisBase.append(otherBase);
			if(keep === thisLayers && base === thisBase) {
				return this;
			}
			return relinkLayers(keep.map(l => l.clone(false)), base);
		}

		/*
		 * Neither block is recognizably an extension of the other, so union them. The longer attach history goes
		 * first so its order survives and the other block only contributes what it alone saw: R searches the most
		 * recently attached package first, and only the longer block still records that order.
		 * Keyed by type and then by name, rather than by a `t:n` string built for every layer of every merge.
		 */
		const order: Environment[] = [];
		const merged = new Map<EnvType | undefined, Map<string | undefined, Environment>>();
		for(const layers of thisLayers.length > otherLayers.length ? [thisLayers, otherLayers] : [otherLayers, thisLayers]) {
			for(const layer of layers) {
				let byName = merged.get(layer.t);
				if(byName === undefined) {
					byName = new Map();
					merged.set(layer.t, byName);
				}
				const existing = byName.get(layer.n);
				if(existing === undefined) {
					const cloned = layer.clone(false);
					byName.set(layer.n, cloned);
					order.push(cloned);
				} else if(!existing.sameMemoryAs(layer)) {
					for(const [name, value] of layer.memory) {
						const old = existing.memory.get(name);
						if(old !== value) {
							existing.writableMemory.set(name, old ? uniqueMergeValuesInDefinitions(old, value) : value);
						}
					}
				}
			}
		}

		return relinkLayers(order, thisBase.append(otherBase));
	}

	public remove(id: Identifier) {
		if(this.builtInEnv) {
			return this;
		}
		const [name, ns] = Identifier.toArray(id);
		if(ns !== undefined && this.n !== ns) {
			this.writableParent.remove(id);
			return this;
		}
		const definition = this.lookup(name);
		let cont = true;
		if(definition !== undefined) {
			this.writableMemory.delete(name);
			this.cache?.delete(name);
			cont = !definition.every(d => happensInEveryBranch(d.cds));
		}
		if(cont) {
			this.writableParent.remove(name);
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
			memory:     new Map(this.memory),
		} : {
			id:        this.id,
			parent:    this.parent,
			memory:    new Map(this.memory),
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

/** Walks up to the built-in environment. */
function findBuiltInEnvironment(this: void, env: Environment): Environment {
	let current = env;
	while(!current.builtInEnv) {
		current = current.parent;
	}
	return current;
}

/** The `search()` position directly below the global environment; where R attaches by default. */
export const DefaultAttachPosition = 2;

/** Prefix of a package's entry in R's `search()` list. */
export const SearchPathPackagePrefix = 'package:';

/** Name of the global environment in R's `search()` list. */
export const GlobalEnvEntryName = '.GlobalEnv';

/**
 * Splices a package block (`blockTop`..`blockBottom`) into the search path at the 1-based `search()` position `pos`
 *  ({@link DefaultAttachPosition|2} by default); a position past the end attaches above the built-in env, mirroring R's clamping.
 */
function attachPackageAt(this: void, current: Environment, blockTop: Environment, blockBottom: Environment, pos: number = DefaultAttachPosition): Environment {
	const clonedCurrent = current.clone(false);
	let anchor = clonedCurrent;
	while(!anchor.globalEnv && !anchor.parent.builtInEnv) {
		anchor.parent = anchor.parent.clone(false);
		anchor = anchor.parent;
	}
	/* walk past the `pos - 2` search entries below the global; an imports layer belongs to the entry above it and is never one itself */
	for(let skip = pos - DefaultAttachPosition; skip > 0 && !anchor.parent.builtInEnv; skip--) {
		do{
			anchor.parent = anchor.parent.clone(false);
			anchor = anchor.parent;
		} while(anchor.parent.t === EnvType.Imports);
	}
	blockBottom.parent = anchor.parent; // the built-in env, or the packages attached further down
	anchor.parent = blockTop;
	return clonedCurrent;
}

/**
 * The 1-based `search()` position of the entry called `name` (`.GlobalEnv`, `package:x`, or a bare package name), or
 *  `undefined` if absent; `package:base` resolves to the built-in env at the bottom if base R is not attached as its own layer.
 */
function searchPositionOf(this: void, env: Environment, name: string): number | undefined {
	const target = name.startsWith(SearchPathPackagePrefix) ? name.slice(SearchPathPackagePrefix.length) : name;
	if(target === GlobalEnvEntryName) {
		return 1;
	}
	let pos = 1;
	for(let e = findGlobalEnvironment(env).parent; !e.builtInEnv; e = e.parent) {
		if(e.t === EnvType.Imports) {
			continue; // internal layer, not a search-path entry
		}
		pos++;
		if(e.n === target) {
			return pos;
		}
	}
	return target === PkgName.Base ? pos + 1 : undefined; // base is the built-in env when it is not attached as a layer
}

/**
 * The packages attached below the global environment, i.e. those whose exports R resolves without a namespace.
 * Base is always among them, as it backs the built-in environment even when it is no layer of its own.
 */
function attachedPackagesOf(this: void, env: Environment): Set<string> {
	const attached = new Set<string>([PkgName.Base]);
	for(let e = findGlobalEnvironment(env).parent; !e.builtInEnv; e = e.parent) {
		if(e.t !== EnvType.Imports && e.n !== undefined) {
			attached.add(e.n);
		}
	}
	return attached;
}

/**
 * Helpers for navigating and manipulating {@link REnvironmentInformation|environments} around the global environment and attached-package search path.
 */
export const REnvironment = {
	name:             'REnvironment',
	/** Walks up to the global environment (`.GlobalEnv`); see {@link findGlobalEnvironment}. */
	findGlobal:       findGlobalEnvironment,
	/** Walks up to the built-in environment; see {@link findBuiltInEnvironment}. */
	findBuiltIn:      findBuiltInEnvironment,
	/** Attaches a package block at a `search()` position, below the global by default; see {@link attachPackageAt}. */
	attachAt:         attachPackageAt,
	/** The `search()` position of a named entry; see {@link searchPositionOf}. */
	searchPosition:   searchPositionOf,
	/** The packages on the search path; see {@link attachedPackagesOf}. */
	attachedPackages: attachedPackagesOf,
} as const;

/**
 * Whether the package block `layers` ends with `tail` (a block grows at the front, so this is the shape two branches take
 *  when one attached more packages); compares frames by {@link Environment#memory} identity, cheap since clones share it.
 */
function layersEndWith(this: void, layers: readonly Environment[], tail: readonly Environment[]): boolean {
	const offset = layers.length - tail.length;
	if(offset < 0) {
		return false;
	}
	for(let i = 0; i < tail.length; i++) {
		const l = layers[offset + i], t = tail[i];
		if(l !== t && (l.t !== t.t || l.n !== t.n || !l.sameMemoryAs(t))) {
			return false;
		}
	}
	return true;
}

/** Stacks `layers` (top first) on top of `base`, returning the new top of the chain. The layers must not be shared. */
function relinkLayers(this: void, layers: readonly Environment[], base: Environment): Environment {
	let current = base;
	for(let i = layers.length - 1; i >= 0; i--) {
		layers[i].parent = current;
		current = layers[i];
	}
	return current;
}

/** Splits a package block (a contiguous run of attached-package layers, see {@link EnvType}) into its layers and the env below them. */
function splitLibraryLayers(this: void, env: Environment): [Environment[], Environment] {
	const layers: Environment[] = [];
	let current = env;
	while(current.t !== undefined && !current.builtInEnv) {
		layers.push(current);
		current = current.parent;
	}
	return [layers, current];
}

/**
 * A ({@link IEnvironment#parent|scoped}) mapping of names to their definitions ({@link BuiltIns}).
 * The {@link BuiltIns|BuiltInEnvironment} holds R's built-in functions and constants; use {@link builtInEnvJsonReplacer} during serialization to avoid inlining it.
 */
export interface REnvironmentInformation {
	/** The currently active environment (the stack is represented by the {@link IEnvironment#parent} chain). */
	readonly current: Environment
	/** nesting level of the environment, will be `0` for the global/root environment */
	readonly level:   number
}

/** Serializes an environment, replacing the built-in environment with a placeholder. */
export function builtInEnvJsonReplacer(k: unknown, v: unknown): unknown {
	if(isDefaultBuiltInEnvironment(v)) {
		return '<BuiltInEnvironment>';
	} else {
		return jsonReplacer(k, v);
	}
}
