/**
 * One environment frame's bindings, shared by every snapshot of it: a snapshot is the frame plus a version, not a
 * copy. Copying instead cost a whole map per snapshot, and a call vertex keeps one, so a scope with thousands of
 * definitions retained memory in the square of them. The newest version is answered from a plain map, an older one
 * from what the writes recorded.
 * @module
 */

import { guard } from '../../util/assert';
import type { BrandedIdentifier, IdentifierDefinition } from './identifier';

/** `[version, bindings, ...]` for one name, versions ascending, `undefined` once removed; flat to allocate once */
type History = (number | IdentifierDefinition[] | undefined)[];

/** the index in `history` of what the greatest version at most `version` bound, `-1` if unbound then */
function at(history: History, version: number): number {
	let low = 0;
	let high = (history.length >> 1) - 1;
	while(low <= high) {
		const mid = (low + high) >> 1;
		if((history[mid << 1] as number) <= version) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return high < 0 ? -1 : (high << 1) + 1;
}

/**
 * One frame's bindings across its versions. A frame {@link Frame.of|taken from a map} is frozen: one state, never
 * written, versioned only once {@link forWrite} forks it -- the built-in environment and the package layers.
 */
export class Frame {
	/** the bindings at {@link version} and no other, so read it only after checking the version, as {@link get} does */
	public readonly live:    Map<BrandedIdentifier, IdentifierDefinition[]>;
	/** whether {@link live} is this frame's own to write, see {@link Frame.of} */
	private readonly frozen: boolean;
	/** what each *rewritten* name held per version, for older snapshots; built on the first rewrite, as most see none */
	private history:         Map<BrandedIdentifier, History> | undefined;
	/** when each name still on its first binding came in; a write-once name needs no more, and most are */
	private bornAt:          Map<BrandedIdentifier, number> | undefined;
	/** the last past version walked out into a map, so re-reading that snapshot skips the walk; one slot only */
	private walked:          { version: number, bindings: ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]> } | undefined;
	/** the newest version written here, counting this frame's writes alone; only a snapshot at it may extend the frame */
	public version = 0;

	private constructor(live: Map<BrandedIdentifier, IdentifierDefinition[]>, frozen: boolean) {
		this.live = live;
		this.frozen = frozen;
	}

	/** A frame holding what `map` holds, frozen: only read through here, a write forks rather than reaching back. */
	public static of(map: ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>): Frame {
		return new Frame(map as Map<BrandedIdentifier, IdentifierDefinition[]>, true);
	}

	/** A frame holding nothing, the same one every time, so an environment that defines nothing allocates nothing. */
	public static empty(): Frame {
		return EmptyFrame;
	}

	/** What `name` held at `version`. One lookup for the newest version, small enough for V8 to inline. */
	public get(name: BrandedIdentifier, version: number): IdentifierDefinition[] | undefined {
		return version === this.version ? this.live.get(name) : this.bound(name, version);
	}

	/** What `name` held at a version written past since. */
	private bound(name: BrandedIdentifier, version: number): IdentifierDefinition[] | undefined {
		const history = this.history?.get(name);
		if(history !== undefined) {
			const index = at(history, version);
			return index < 0 ? undefined : history[index] as IdentifierDefinition[] | undefined;
		}
		const born = this.bornAt?.get(name);
		/* never rewritten, so it still holds what it held then -- unless it came in after then */
		return born !== undefined && born > version ? undefined : this.live.get(name);
	}

	/** Whether `name` was bound at `version`. */
	public has(name: BrandedIdentifier, version: number): boolean {
		return (version === this.version ? this.live.get(name) : this.bound(name, version)) !== undefined;
	}

	/** The names `version` binds. */
	public keys(version: number): MapIterator<BrandedIdentifier> {
		return (this.settledAt(version) ?? this.materialize(version)).keys();
	}

	/** What `version` binds, without the names. */
	public values(version: number): MapIterator<IdentifierDefinition[]> {
		return (this.settledAt(version) ?? this.materialize(version)).values();
	}

	/** How many names `version` binds. */
	public size(version: number): number {
		return (this.settledAt(version) ?? this.materialize(version)).size;
	}

	/** What `version` binds, name by name. */
	public entries(version: number): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return (this.settledAt(version) ?? this.materialize(version)).entries();
	}

	/**
	 * `version` as a map, `undefined` when it has to be walked out. A frame that never rewrote or took on a name has
	 * held the same bindings throughout, so {@link live} answers for any version of it.
	 */
	public settledAt(version: number): ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]> | undefined {
		if(version === this.version || (this.history === undefined && this.bornAt === undefined)) {
			return this.live;
		}
		const walked = this.walked;
		return walked !== undefined && walked.version === version ? walked.bindings : undefined;
	}

	/** `version` walked out into a map, kept in the {@link walked} slot. */
	private materialize(version: number): ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]> {
		const bindings = new Map(this.recorded(version));
		this.walked = { version, bindings };
		return bindings;
	}

	/** What `version` bound; the rewritten names come first, since one dropped since is no longer in {@link live}. */
	private *recorded(version: number): IterableIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		const history = this.history;
		if(history !== undefined) {
			for(const name of history.keys()) {
				const defs = this.bound(name, version);
				if(defs !== undefined) {
					yield [name, defs];
				}
			}
		}
		for(const [name, defs] of this.live) {
			if(history?.has(name)) {
				continue;
			}
			const born = this.bornAt?.get(name);
			if(born === undefined || born <= version) {
				yield [name, defs];
			}
		}
	}

	/** The frame a snapshot at `version` writes to: this one if it holds the newest version, a fork otherwise. */
	public forWrite(version: number): Frame {
		if(!this.frozen && version === this.version) {
			return this;
		}
		return new Frame(new Map(this.settledAt(version) ?? this.materialize(version)), false);
	}

	/** The version the next write goes to; only a frame {@link forWrite} just returned may hand one out. */
	public nextVersion(): number {
		guard(!this.frozen, 'a frozen frame hands out no version, fork it with forWrite first');
		return ++this.version;
	}

	/** Binds `name` at `version`, `undefined` removing it. Only the newest version may be written; snapshots hold the rest. */
	public set(name: BrandedIdentifier, defs: IdentifierDefinition[] | undefined, version: number): void {
		const live = this.live;
		guard(!this.frozen && version === this.version, () => `cannot write version ${version} of a frame standing at ${this.version}`);
		const history = this.history?.get(name);
		if(history !== undefined) {
			if(history[history.length - 2] === version) {
				history[history.length - 1] = defs;
			} else {
				history.push(version, defs);
			}
		} else {
			const before = live.get(name);
			const born = this.bornAt?.get(name);
			if(before === undefined && born === undefined) {
				/* never held here, so when it came in is all an older snapshot needs */
				(this.bornAt ??= new Map()).set(name, version);
			} else {
				/* record what it is replacing before the write buries it */
				this.bornAt?.delete(name);
				(this.history ??= new Map()).set(name, [born ?? 0, before, version, defs]);
			}
		}
		if(defs === undefined) {
			live.delete(name);
		} else {
			live.set(name, defs);
		}
	}
}

/** what every environment starts out on, until a write forks it one of its own */
const EmptyFrame = Frame.of(new Map<BrandedIdentifier, IdentifierDefinition[]>());

/** One environment's view of its {@link Frame}, as a {@link ReadonlyMap} so the old readers of the map still work. */
export class MemoryView implements ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]> {
	constructor(public readonly frame: Frame, public readonly version: number) {}

	public get(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		return this.frame.get(name, this.version);
	}

	public has(name: BrandedIdentifier): boolean {
		return this.frame.has(name, this.version);
	}

	public get size(): number {
		return this.frame.size(this.version);
	}

	public entries(): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.frame.entries(this.version);
	}

	public [Symbol.iterator](): MapIterator<[BrandedIdentifier, IdentifierDefinition[]]> {
		return this.frame.entries(this.version);
	}

	public keys(): MapIterator<BrandedIdentifier> {
		return this.frame.keys(this.version);
	}

	public values(): MapIterator<IdentifierDefinition[]> {
		return this.frame.values(this.version);
	}

	public forEach(fn: (defs: IdentifierDefinition[], name: BrandedIdentifier, map: ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>) => void, thisArg?: unknown): void {
		const settled = this.frame.settledAt(this.version);
		if(settled !== undefined) {
			settled.forEach(fn, thisArg);
			return;
		}
		for(const [name, defs] of this.frame.entries(this.version)) {
			fn.call(thisArg, defs, name, this);
		}
	}
}

/** The write end of a {@link Frame} at one version, standing in for the map writers used to get. */
export class WritableMemory {
	constructor(private readonly frame: Frame, private readonly version: number) {}

	public set(name: BrandedIdentifier, defs: IdentifierDefinition[]): void {
		this.frame.set(name, defs, this.version);
	}

	public delete(name: BrandedIdentifier): void {
		this.frame.set(name, undefined, this.version);
	}

	public get(name: BrandedIdentifier): IdentifierDefinition[] | undefined {
		return this.frame.get(name, this.version);
	}

	public has(name: BrandedIdentifier): boolean {
		return this.frame.has(name, this.version);
	}
}
