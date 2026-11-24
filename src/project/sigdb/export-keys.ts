/**
 * The reverse index of a bundle, `dictionary id of a name -> the packages exporting it`, kept as one sorted run of numbers
 * (`id * {@link OrdinalStride} + package ordinal`) so a lookup is a binary search. Deriving it decodes every package, so
 * {@link ExportKeys.persist|persisting} it next to the bundle lets later processes answer from a few ranged reads.
 */
import fs from 'fs';
import { moveIntoPlace, uniqueTempPath } from './decompress';

/** the ordinals of a bundle's packages stay below this, so a key keeps the name id and the ordinal apart exactly */
const OrdinalStride = 2 ** 21;
const KeyBytes = Float64Array.BYTES_PER_ELEMENT;
/** the file extension of the persisted index, appended to the plain bundle */
const ExportKeysExt = '.exports';

export interface ExportKeys {
	/** the ordinals of the packages exporting the name with dictionary id `id`, ascending */
	ordinalsOf(id: number): number[]
}

/** the index over `keys`, which {@link buildKeys} sorted */
function inMemory(keys: Float64Array): ExportKeys {
	return { ordinalsOf: id => collect(keys.length, at => keys[at], id) };
}

/** the sorted keys of the `[name id, package ordinal]` pairs, each pair once */
function buildKeys(pairs: Iterable<readonly [id: number, ordinal: number]>): Float64Array {
	const keys = Float64Array.from(pairs, ([id, ordinal]) => id * OrdinalStride + ordinal).sort();
	let unique = 0;
	for(let i = 0; i < keys.length; i++) {
		if(i === 0 || keys[i] !== keys[i - 1]) {
			keys[unique++] = keys[i];
		}
	}
	return keys.slice(0, unique);
}

/** the ordinals of the keys of `id`, off a sorted run read through `keyAt` */
function collect(count: number, keyAt: (at: number) => number, id: number): number[] {
	let lo = 0, hi = count;
	while(lo < hi) {
		const mid = (lo + hi) >> 1;
		if(keyAt(mid) < id * OrdinalStride) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	const ordinals: number[] = [];
	for(let key = lo < count ? keyAt(lo) : Infinity; key < (id + 1) * OrdinalStride; key = ++lo < count ? keyAt(lo) : Infinity) {
		ordinals.push(key % OrdinalStride);
	}
	return ordinals;
}

/** what a persisted index was derived from: the package count and when the bundle was last written, which a bundle rebuilt in place changes */
type Stamp = readonly [packages: number, written: number];
const StampKeys = 2;

/** the persisted index at `file` when it exists and was derived for `stamp`, answering by ranged reads */
function readPersisted(file: string, stamp: Stamp): ExportKeys | undefined {
	let size: number;
	try {
		size = fs.statSync(file).size;
	} catch{
		return undefined;
	}
	const head = Buffer.allocUnsafe(KeyBytes);
	const at = (fd: number, i: number): number => (fs.readSync(fd, head, 0, KeyBytes, i * KeyBytes), head.readDoubleLE(0));
	const count = size / KeyBytes - StampKeys;
	const fd = fs.openSync(file, 'r');
	try {
		if(!Number.isInteger(count) || count < 0 || stamp.some((s, i) => at(fd, i) !== s)) {
			return undefined;
		}
	} finally {
		fs.closeSync(fd);
	}
	return {
		ordinalsOf: id => {
			const reading = fs.openSync(file, 'r');
			try {
				return collect(count, i => at(reading, i + StampKeys), id);
			} finally {
				fs.closeSync(reading);
			}
		}
	};
}

/** write the index next to the bundle, not failing the query when the directory does not let us */
function persist(file: string, stamp: Stamp, keys: Float64Array): void {
	const tmp = uniqueTempPath(file, 'tmp');
	try {
		const out = new Float64Array(keys.length + StampKeys);
		out.set(stamp);
		out.set(keys, StampKeys);
		fs.writeFileSync(tmp, new Uint8Array(out.buffer));
		moveIntoPlace(tmp, file);
	} catch{
		/* read-only location: the index then lives for this process only */
	} finally {
		fs.rmSync(tmp, { force: true });
	}
}

/**
 * The export index of a bundle of `packages` packages: the one persisted for `bundleFile` when there is one, otherwise
 * derived from `pairs` (computed on demand) and persisted for the next process. Without a file, kept in memory only.
 */
export function exportKeysFor(bundleFile: string | undefined, packages: number, pairs: () => Iterable<readonly [id: number, ordinal: number]>): ExportKeys {
	const file = bundleFile === undefined ? undefined : bundleFile + ExportKeysExt;
	const stamp: Stamp | undefined = bundleFile === undefined ? undefined : [packages, fs.statSync(bundleFile).mtimeMs];
	const persisted = file === undefined || stamp === undefined ? undefined : readPersisted(file, stamp);
	if(persisted !== undefined) {
		return persisted;
	}
	const keys = buildKeys(pairs());
	if(file === undefined || stamp === undefined) {
		return inMemory(keys);
	}
	persist(file, stamp, keys);
	return readPersisted(file, stamp) ?? inMemory(keys);
}
