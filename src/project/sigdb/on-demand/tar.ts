import zlib from 'zlib';

/** How much an archive may unpack to, so a hostile or broken one cannot exhaust the memory. */
export interface TarLimits {
	/** the most bytes the (decompressed) archive may hold */
	readonly maxArchiveBytes: number;
	/** the most bytes a single kept file may hold, a bigger one is skipped */
	readonly maxFileBytes:    number;
	/** the most files to keep */
	readonly maxFiles:        number;
}

export const DefaultTarLimits: TarLimits = { maxArchiveBytes: 128 * 1024 * 1024, maxFileBytes: 8 * 1024 * 1024, maxFiles: 5000 };

/** the error for an archive that is not a tar (or gzip'ed tar) flowR can read */
export class TarError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'TarError';
	}
}

const Block = 512;

function field(header: Buffer, offset: number, length: number): string {
	const raw = header.subarray(offset, offset + length);
	const end = raw.indexOf(0);
	return raw.subarray(0, end < 0 ? raw.length : end).toString('utf8');
}

function octal(header: Buffer, offset: number, length: number): number {
	/* GNU tar stores big sizes in base-256, marked by the high bit of the first byte */
	if((header[offset] & 0x80) !== 0) {
		let value = 0;
		for(let i = offset + 1; i < offset + length; i++) {
			value = value * 256 + header[i];
		}
		return value;
	}
	const text = field(header, offset, length).trim();
	const value = text.length === 0 ? 0 : parseInt(text, 8);
	if(!Number.isFinite(value) || value < 0) {
		throw new TarError(`invalid number "${text}" in a tar header`);
	}
	return value;
}

/** the `path` record of a pax extended header, which overrides the name of the entry after it */
function paxPath(data: Buffer): string | undefined {
	let at = 0;
	while(at < data.length) {
		const space = data.indexOf(0x20, at);
		if(space < 0) {
			break;
		}
		const length = parseInt(data.subarray(at, space).toString('ascii'), 10);
		if(!Number.isFinite(length) || length <= 0) {
			break;
		}
		const record = data.subarray(space + 1, at + length - 1).toString('utf8');
		if(record.startsWith('path=')) {
			return record.slice(5);
		}
		at += length;
	}
	return undefined;
}

/** the path without the directory every entry of a package tarball sits in (`ggmirt-HEAD/R/a.R` becomes `R/a.R`), `undefined` for one leaving it */
function relativeEntryPath(name: string): string | undefined {
	const parts = name.replaceAll('\\', '/').split('/').filter(p => p.length > 0 && p !== '.');
	if(parts.length < 2 || parts.includes('..') || name.startsWith('/')) {
		return undefined;
	}
	return parts.slice(1).join('/');
}

/**
 * The regular files of a tar archive, gzip'ed or not, whose path below the top directory `keep` accepts,
 * all held in memory: nothing is written to disk, so no entry can reach outside of where it belongs.
 */
export function readTarEntries(archive: Buffer, keep: (path: string) => boolean, limits: TarLimits = DefaultTarLimits): Map<string, Buffer> {
	let tar = archive;
	if(archive.length >= 2 && archive[0] === 0x1f && archive[1] === 0x8b) {
		try {
			tar = zlib.gunzipSync(archive, { maxOutputLength: limits.maxArchiveBytes });
		} catch(e) {
			throw new TarError(`cannot decompress the archive: ${(e as Error).message}`);
		}
	}
	const files = new Map<string, Buffer>();
	let longName: string | undefined;
	for(let at = 0; at + Block <= tar.length;) {
		const header = tar.subarray(at, at + Block);
		if(header.every(b => b === 0)) {
			break;
		}
		const size = octal(header, 124, 12);
		const type = String.fromCharCode(header[156] || 0x30);
		const start = at + Block;
		if(start + size > tar.length) {
			throw new TarError('the archive ends within an entry');
		}
		const data = tar.subarray(start, start + size);
		at = start + Math.ceil(size / Block) * Block;
		if(type === 'L' || type === 'x') {
			longName = type === 'L' ? field(data, 0, data.length) : paxPath(data) ?? longName;
			continue;
		}
		const magic = field(header, 257, 6);
		const prefix = magic.startsWith('ustar') ? field(header, 345, 155) : '';
		const name = longName ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
		longName = undefined;
		if(type !== '0' && type !== '\0' && type !== '7') {
			continue;
		}
		const relative = relativeEntryPath(name);
		if(relative === undefined || size > limits.maxFileBytes || !keep(relative)) {
			continue;
		}
		if(files.size >= limits.maxFiles) {
			throw new TarError(`the archive holds more than ${limits.maxFiles} wanted files`);
		}
		files.set(relative, Buffer.from(data));
	}
	return files;
}
