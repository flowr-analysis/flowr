/**
 * One environment frame's bindings, shared until something writes: the writer forks, so cloning is free and a
 * definition pays for the copy.
 * @module
 */

import { guard } from '../../util/assert';
import type { BrandedIdentifier, IdentifierDefinition } from './identifier';

/** the bindings of one frame, as everything that only reads them sees it */
export type MemoryView = ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>;

/**
 * Writing to a shared frame used to copy every binding it holds. The frames that get written to are the big
 * ones -- a global frame after a few `library()` calls carries some two thousand names -- and one `x <- 1` at
 * that scope copied all of them, so a project ended up holding a full near-duplicate of its global environment
 * per definition. Above this many bindings a write forks into an {@link Frame.forWrite|overlay} instead: the
 * base is kept as it is and only what the writer touches is held on top.
 *
 * Below it, copying stays the cheaper answer, as it keeps lookups to a single map access.
 */
const OverlayThreshold = 64;

/**
 * How many overlays may stack before a write copies instead. A lookup walks the stack, so this bounds what a
 * miss costs; a frame deep enough to reach it is one written to over and over, where a copy pays off.
 */
const MaxOverlayDepth = 4;

/**
 * One frame's bindings. {@link Frame.of|Taken from a map} it is frozen, since the map is somebody else's.
 *
 * A frame either owns all of its bindings, or holds what was written on top of a `base` it shares with
 * whoever it forked from, see {@link Frame.forWrite}. The two read the same from the outside.
 */
export class Frame implements MemoryView {
	/** what this frame holds itself: every binding, or only what was written over {@link base} */
	private readonly bindings: Map<BrandedIdentifier, IdentifierDefinition[]>;
	private readonly frozen:   boolean;
	/** what this frame sits on, absent when it owns its bindings */
	private readonly base?:    MemoryView;
	/** the names of `base` this frame has dropped, absent when nothing was dropped */
	private removed?:          Set<BrandedIdentifier>;

	private constructor(bindings: Map<BrandedIdentifier, IdentifierDefinition[]>, frozen: boolean, base?: MemoryView) {
		this.bindings = bindings;
		this.frozen = frozen;
		this.base = base;
	}

	/** A frame over `map`, frozen, so a write forks rather than reaching back into it. */
	public static of(map: MemoryView): Frame {
		return new Frame(map as Map<BrandedIdentifier, IdentifierDefinition[]>, true);
	}

	/** The empty frame, the same one every time, so an environment defining nothing allocates nothing. */
	public static empty(): Frame {
		return EmptyFrame;
	}

	/**
	 * A frame the caller may write to, holding what this one holds. A small frame is copied outright; a big one
	 * becomes the base of an overlay, see {@link OverlayThreshold}. An overlay is big by construction, so it
	 * overlays again until the stack reaches {@link MaxOverlayDepth}, where a copy flattens it.
	 */
	public forWrite(): Frame {
		if(this.stacked() >= MaxOverlayDepth) {
			return new Frame(new Map(this), false);
		} else if(this.base !== undefined || this.bindings.size > OverlayThreshold) {
			return new Frame(new Map(), false, this);
		}
		return new Frame(new Map(this.bindings), false);
	}

	/** How many overlays are stacked below this one, which bounds what a lookup miss walks. */
	private stacked(): number {
		let n = 0;
		for(let at: MemoryView | undefined = this.base; at instanceof Frame; at = at.base) {
			n++;
		}
		return n;
	}

	public set(name: BrandedIdentifier, defs: IdentifierDefinition[]): void {
		guard(!this.frozen, 'a frozen frame takes no writes, fork it with forWrite first');
		this.bindings.set(name, defs);
		this.removed?.delete(name);
	}

	public delete(name: BrandedIdentifier): void {
		guard(!this.frozen, 'a frozen frame takes no writes, fork it with forWrite first');
		this.bindings.delete(name);
		if(this.base?.has(name)) {
			(this.removed ??= new Set()).add(name);
		}
	}

	public get(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		const own = this.bindings.get(name);
		if(own !== undefined || this.base === undefined || this.removed?.has(name)) {
			return own;
		}
		return this.base.get(name);
	}

	public has(name: BrandedIdentifier): boolean {
		return this.bindings.has(name)
			|| (this.base !== undefined && !this.removed?.has(name) && this.base.has(name));
	}

	/** How many names this binds; an overlay counts what it adds on top of its base. */
	public get size(): number {
		if(this.base === undefined) {
			return this.bindings.size;
		}
		let size = this.base.size - (this.removed?.size ?? 0);
		for(const name of this.bindings.keys()) {
			if(!this.base.has(name) || this.removed?.has(name)) {
				size++;
			}
		}
		return size;
	}

	public keys(): MapIterator<BrandedIdentifier> {
		return this.base === undefined ? this.bindings.keys() : this.overlaidKeys();
	}

	public values(): MapIterator<IdentifierDefinition[]> {
		return this.base === undefined ? this.bindings.values() : this.overlaidValues();
	}

	public entries(): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.base === undefined ? this.bindings.entries() : this.overlaidEntries();
	}

	public [Symbol.iterator](): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.entries();
	}

	public forEach(fn: (defs: IdentifierDefinition[], name: BrandedIdentifier, map: MemoryView) => void, thisArg?: unknown): void {
		if(this.base === undefined) {
			this.bindings.forEach(fn as never, thisArg);
			return;
		}
		for(const [name, defs] of this.overlaidEntries()) {
			fn.call(thisArg, defs, name, this);
		}
	}

	/**
	 * What an overlay binds: the base first, so a name keeps the position it was defined at, then what is new.
	 * A frame owning its bindings never reaches this, it hands out the map's own iterator.
	 */
	private *overlaidEntries(): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		const base = this.base as MemoryView;
		for(const [name, defs] of base) {
			if(!this.removed?.has(name)) {
				yield [name, this.bindings.get(name) ?? defs];
			}
		}
		for(const [name, defs] of this.bindings) {
			if(!base.has(name) || this.removed?.has(name)) {
				yield [name, defs];
			}
		}
	}

	private *overlaidKeys(): MapIterator<BrandedIdentifier> {
		for(const [name] of this.overlaidEntries()) {
			yield name;
		}
	}

	private *overlaidValues(): MapIterator<IdentifierDefinition[]> {
		for(const [, defs] of this.overlaidEntries()) {
			yield defs;
		}
	}
}

/** what every environment starts out on, until a write forks it one of its own */
const EmptyFrame = Frame.of(new Map<BrandedIdentifier, IdentifierDefinition[]>());

/**
 * The bindings of an attached package, built one name at a time. An attach used to materialize a definition per
 * export, and a script attaching a handful of packages carries hundreds of thousands of them for the few dozen
 * names it ever mentions. Here the export list is all that is held until a lookup asks for one.
 */
export class LazyBindings implements MemoryView {
	private readonly built = new Map<BrandedIdentifier, IdentifierDefinition[]>();

	constructor(
		private readonly names:   ReadonlySet<BrandedIdentifier>,
		private readonly bind:    (name: BrandedIdentifier) => IdentifierDefinition[]
	) {}

	public get(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		if(!this.names.has(name)) {
			return undefined;
		}
		let defs = this.built.get(name);
		if(defs === undefined) {
			this.built.set(name, defs = this.bind(name));
		}
		return defs;
	}

	public has(name: BrandedIdentifier): boolean {
		return this.names.has(name);
	}

	public get size(): number {
		return this.names.size;
	}

	public keys(): MapIterator<BrandedIdentifier> {
		return this.names.keys();
	}

	public *entries(): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		for(const name of this.names) {
			yield [name, this.get(name) as IdentifierDefinition[]];
		}
	}

	public [Symbol.iterator](): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.entries();
	}

	public *values(): MapIterator<IdentifierDefinition[]> {
		for(const [, defs] of this.entries()) {
			yield defs;
		}
	}

	public forEach(fn: (defs: IdentifierDefinition[], name: BrandedIdentifier, map: MemoryView) => void, thisArg?: unknown): void {
		for(const [name, defs] of this.entries()) {
			fn.call(thisArg, defs, name, this);
		}
	}
}
