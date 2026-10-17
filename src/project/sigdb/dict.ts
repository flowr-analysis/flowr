/**
 * A bundle's string dictionary, held as the bytes of its names rather than as an array of strings.
 * Split apart, a dictionary of 1.4 million names cost a slice object per name and kept the text alive
 * through them anyway; as one buffer it is off the JS heap entirely, which is what a worker's
 * `--max-old-space-size` bounds, and a name is built only when something asks for it.
 * @module
 */

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
		if(names.length === 0) {
			return new SigDict(Buffer.alloc(0), new Int32Array(0));
		}
		const bytes = Buffer.from(names.join('\n'), 'utf8');
		const ends = new Int32Array(names.length);
		for(let i = 0, from = 0; i < ends.length; i++) {
			const newline = bytes.indexOf(Newline, from);
			ends[i] = newline < 0 ? bytes.length : newline;
			from = ends[i] + 1;
		}
		return new SigDict(bytes, ends);
	}

	/**
	 * The dictionary a bundle's `d` lines spell out, each `["d", start, "name\nname..."]` (or the legacy `["d", start, [names]]`).
	 * The names are unescaped from the line's bytes straight into the dictionary, as parsing every line into a string only to
	 * encode it back took most of the time opening a database costs. The runs must cover the ids from `0` without a gap.
	 */
	public static ofLines(lines: Buffer): SigDict {
		const runs = dictRuns(lines).sort((a, b) => a.start - b.start);
		if(runs.length === 0) {
			return new SigDict(Buffer.alloc(0), new Int32Array(0));
		}
		/* unescaping only shrinks a payload, and a newline joins two runs */
		const out = Buffer.allocUnsafe(runs.reduce((size, run) => size + run.bytes.length, runs.length - 1));
		const ends = new NameEnds();
		let at = 0;
		for(let r = 0; r < runs.length; r++) {
			if(r > 0) {
				ends.push(at);
				out[at++] = Newline;
			}
			at = runs[r].escaped ? unescapeInto(runs[r].bytes, out, at, ends) : copyInto(runs[r].bytes, out, at, ends);
		}
		ends.push(at);
		return new SigDict(Buffer.from(out.subarray(0, at)), ends.done());
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

/** one `d` line: where its names start, and their bytes, still JSON-escaped unless `escaped` is false */
interface DictRun {
	readonly start:   number;
	readonly bytes:   Buffer;
	readonly escaped: boolean;
}

const Quote = 0x22, Backslash = 0x5c, Comma = 0x2c, Zero = 0x30, Nine = 0x39;
/** what a JSON escape other than `\u` stands for, by the byte after the backslash */
const SimpleEscapes = new Uint8Array(128);
for(const [escape, plain] of [['n', Newline], ['t', 0x09], ['r', 0x0d], ['b', 0x08], ['f', 0x0c], ['"', Quote], ['\\', Backslash], ['/', 0x2f]] as const) {
	SimpleEscapes[escape.charCodeAt(0)] = plain;
}
/** `["d",` */
const RunPrefix = Buffer.from('["d",');

/** The `d` lines of `lines`, the blob form read off the bytes as it is and anything else through `JSON.parse`. */
function dictRuns(lines: Buffer): DictRun[] {
	const runs: DictRun[] = [];
	for(let from = 0; from < lines.length;) {
		let to = lines.indexOf(Newline, from);
		if(to < 0) {
			to = lines.length;
		}
		if(to > from) {
			runs.push(blobRun(lines, from, to) ?? parsedRun(lines.toString('utf8', from, to)));
		}
		from = to + 1;
	}
	return runs;
}

/** `["d",<start>,"<names>"]` between `from` and `to`, `undefined` if the line has another shape */
function blobRun(lines: Buffer, from: number, to: number): DictRun | undefined {
	if(lines.compare(RunPrefix, 0, RunPrefix.length, from, from + RunPrefix.length) !== 0) {
		return undefined;
	}
	let at = from + RunPrefix.length, start = 0;
	for(; at < to && lines[at] >= Zero && lines[at] <= Nine; at++) {
		start = start * 10 + lines[at] - Zero;
	}
	const blob = at + 1;
	if(at === from + RunPrefix.length || lines[at] !== Comma || lines[blob] !== Quote || lines[to - 2] !== Quote || lines[to - 1] !== 0x5d) {
		return undefined;
	}
	return { start, bytes: lines.subarray(blob + 1, to - 2), escaped: true };
}

function parsedRun(line: string): DictRun {
	const [, start, payload] = JSON.parse(line) as [string, number, string | string[]];
	return { start, bytes: Buffer.from(typeof payload === 'string' ? payload : payload.join('\n'), 'utf8'), escaped: false };
}

/** names already decoded, so only their ends are left to note */
function copyInto(bytes: Buffer, out: Buffer, at: number, ends: NameEnds): number {
	for(let newline = bytes.indexOf(Newline); newline >= 0; newline = bytes.indexOf(Newline, newline + 1)) {
		ends.push(at + newline);
	}
	return at + bytes.copy(out, at);
}

/** Writes the JSON string body `bytes` unescaped into `out` from `at`, noting each name's end, and returns where it stopped. */
function unescapeInto(bytes: Buffer, out: Buffer, at: number, ends: NameEnds): number {
	for(let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		if(b !== Backslash) {
			out[at++] = b;
			continue;
		}
		const escape = bytes[++i];
		if(escape !== 0x75 /* u */) {
			const plain = SimpleEscapes[escape];
			if(plain === Newline) {
				ends.push(at);
			}
			out[at++] = plain;
			continue;
		}
		let code = hexAt(bytes, i + 1);
		i += 4;
		/* a pair of surrogates is one code point, a lone one encodes as U+FFFD like any string write would */
		if(code >= 0xd800 && code <= 0xdbff && bytes[i + 1] === Backslash && bytes[i + 2] === 0x75) {
			const low = hexAt(bytes, i + 3);
			if(low >= 0xdc00 && low <= 0xdfff) {
				code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
				i += 6;
			}
		}
		at += out.write(code >= 0xd800 && code <= 0xdfff ? '\ufffd' : String.fromCodePoint(code), at, 'utf8');
	}
	return at;
}

function hexAt(bytes: Buffer, at: number): number {
	return Number.parseInt(bytes.toString('latin1', at, at + 4), 16);
}

/** where each name ends, grown as the names are written since a line does not say how many it holds */
class NameEnds {
	private ends = new Int32Array(1 << 16);
	private size = 0;

	public push(end: number): void {
		if(this.size === this.ends.length) {
			const grown = new Int32Array(this.ends.length * 2);
			grown.set(this.ends);
			this.ends = grown;
		}
		this.ends[this.size++] = end;
	}

	public done(): Int32Array {
		return this.ends.slice(0, this.size);
	}
}
