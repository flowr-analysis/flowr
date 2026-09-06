/**
 * A bundle's string dictionary, held as the bytes of its names rather than as an array of strings.
 * Split apart, a dictionary of 1.4 million names cost a slice object per name and kept the text alive
 * through them anyway; as one buffer it is off the JS heap entirely, which is what a worker's
 * `--max-old-space-size` bounds, and a name is built only when something asks for it.
 * @module
 */

/** the number of newline-separated pieces in `text`; `''` is one empty piece */
function pieces(text: string): number {
	let count = 1;
	for(let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) {
		count++;
	}
	return count;
}

/** A dictionary's names by id. Ids are positions, so {@link SigDict.at} is what `strings[id]` used to be. */
export class SigDict implements Iterable<string> {
	/** every name in utf8, separated by newlines, so a name never carries one */
	private readonly bytes: Buffer;
	/** where each name ends in {@link bytes}; the next one starts one past that */
	private readonly ends:  Int32Array;

	private constructor(bytes: Buffer, ends: Int32Array) {
		this.bytes = bytes;
		this.ends = ends;
	}

	/** The dictionary `names` spells out. */
	public static of(names: readonly string[]): SigDict {
		return SigDict.ofRuns(names.length === 0 ? [] : [{ start: 0, names: names.join('\n') }]);
	}

	/**
	 * The dictionary the given runs spell out together, each a newline-joined batch of names starting at the id
	 * it names. The runs must cover the ids from `0` without a gap, which is how a bundle writes them.
	 */
	public static ofRuns(runs: readonly { start: number, names: string }[]): SigDict {
		if(runs.length === 0) {
			return new SigDict(Buffer.alloc(0), new Int32Array(0));
		}
		const ordered = [...runs].sort((a, b) => a.start - b.start);
		/* sized in one pass and written in the next, so no run is ever copied twice */
		let size = ordered.length - 1, count = 0;
		for(const run of ordered) {
			size += Buffer.byteLength(run.names, 'utf8');
			count += pieces(run.names);
		}
		const bytes = Buffer.allocUnsafe(size);
		let at = 0;
		for(let i = 0; i < ordered.length; i++) {
			if(i > 0) {
				bytes[at++] = Newline;
			}
			at += bytes.write(ordered[i].names, at, 'utf8');
		}
		const ends = new Int32Array(count);
		for(let i = 0, from = 0; i < ends.length; i++) {
			const newline = bytes.indexOf(Newline, from);
			ends[i] = newline < 0 ? bytes.length : newline;
			from = ends[i] + 1;
		}
		return new SigDict(bytes, ends);
	}

	/** how many names it holds */
	public get length(): number {
		return this.ends.length;
	}

	/** The name with the given id, `''` for an id the dictionary does not hold. */
	public at(id: number): string {
		return id < 0 || id >= this.ends.length ? '' : this.bytes.toString('utf8', this.startOf(id), this.ends[id]);
	}

	/** The group the name with the given id belongs to, as {@link SigDict.keyOf} groups one in hand. */
	public groupOf(id: number): number {
		const start = this.startOf(id);
		return group(this.ends[id] - start, this.bytes[start]);
	}

	/** The group `name` would be in, so a lookup only compares the names that could match it. */
	public static keyOf(name: string): number {
		const bytes = Buffer.from(name, 'utf8');
		return group(bytes.length, bytes[0]);
	}

	private startOf(id: number): number {
		return id === 0 ? 0 : this.ends[id - 1] + 1;
	}

	public *[Symbol.iterator](): Iterator<string> {
		for(let i = 0; i < this.ends.length; i++) {
			yield this.at(i);
		}
	}
}

const Newline = 0x0a;

/** the group a name of that byte length starting with that byte belongs to; the empty name has none of its own */
function group(size: number, first: number): number {
	return size === 0 ? 0 : (first << 8) | Math.min(size, 255);
}
