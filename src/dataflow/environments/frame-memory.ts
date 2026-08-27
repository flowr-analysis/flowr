/**
 * One environment frame's bindings, shared until something writes: the writer forks, so cloning is free and a
 * definition pays for the copy.
 * @module
 */

import { guard } from '../../util/assert';
import type { BrandedIdentifier, IdentifierDefinition } from './identifier';

/** the bindings of one frame, as everything that only reads them sees it */
export type MemoryView = ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>;

/** One frame's bindings. {@link Frame.of|Taken from a map} it is frozen, since the map is somebody else's. */
export class Frame implements MemoryView {
	private readonly bindings: Map<BrandedIdentifier, IdentifierDefinition[]>;
	private readonly frozen:   boolean;

	private constructor(bindings: Map<BrandedIdentifier, IdentifierDefinition[]>, frozen: boolean) {
		this.bindings = bindings;
		this.frozen = frozen;
	}

	/** A frame over `map`, frozen, so a write forks rather than reaching back into it. */
	public static of(map: MemoryView): Frame {
		return new Frame(map as Map<BrandedIdentifier, IdentifierDefinition[]>, true);
	}

	/** The empty frame, the same one every time, so an environment defining nothing allocates nothing. */
	public static empty(): Frame {
		return EmptyFrame;
	}

	/** A copy of these bindings that the caller owns. */
	public forWrite(): Frame {
		return new Frame(new Map(this.bindings), false);
	}

	public set(name: BrandedIdentifier, defs: IdentifierDefinition[]): void {
		guard(!this.frozen, 'a frozen frame takes no writes, fork it with forWrite first');
		this.bindings.set(name, defs);
	}

	public delete(name: BrandedIdentifier): void {
		guard(!this.frozen, 'a frozen frame takes no writes, fork it with forWrite first');
		this.bindings.delete(name);
	}

	public get(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		return this.bindings.get(name);
	}

	public has(name: BrandedIdentifier): boolean {
		return this.bindings.has(name);
	}

	public get size(): number {
		return this.bindings.size;
	}

	public keys(): MapIterator<BrandedIdentifier> {
		return this.bindings.keys();
	}

	public values(): MapIterator<IdentifierDefinition[]> {
		return this.bindings.values();
	}

	public entries(): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.bindings.entries();
	}

	public [Symbol.iterator](): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.bindings.entries();
	}

	public forEach(fn: (defs: IdentifierDefinition[], name: BrandedIdentifier, map: MemoryView) => void, thisArg?: unknown): void {
		this.bindings.forEach(fn as never, thisArg);
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
