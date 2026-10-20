/**
 * Keeps the playgrounds of earlier releases under `wiki/playground/v/<version>/`, taken from the site before it is
 * replaced. Kept are the newest patch of every other minor release of the current major, the newest release of each
 * earlier major, and every release tagged `playground/v<version>`.
 * A kept playground is stored as the gzipped difference to the playground the site serves, which a small page applies
 * in the browser: two releases share most of their bytes, so one costs a few hundred kilobytes rather than megabytes.
 * Usage: `ts-node scripts/keep-playground-versions.ts <previous>`, the `wiki/playground` folder served so far.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { execSync } from 'child_process';
import semver from 'semver';

const Target = path.join('wiki', 'playground');
const Files = ['index.html', 'bundle.js'] as const;
type Files = Record<typeof Files[number], Buffer>;
/* registered as a service worker, which has to be a file of its own next to the page */
const Guard = 'webr-guard.js';
/** the bytes a copy has to share at least, and how far apart the places in the reference are that a copy may start at */
const Window = 16, Step = 4;

const releaseOf = (page: Buffer | string): string | undefined => /data-release="v?([^"]+)"/.exec(page.toString())?.[1];
const sha = (data: Uint8Array): string => crypto.createHash('sha256').update(data).digest('hex');

function varint(n: number): Buffer {
	const out: number[] = [];
	for(; n > 127; n = Math.floor(n / 128)) {
		out.push(n % 128 + 128);
	}
	out.push(n);
	return Buffer.from(out);
}

/**
 * `target` as runs of new bytes and copies out of `reference`: its length, then the count and bytes of a run, the length
 * of a copy, and where it starts relative to the end of the copy before (zigzag), over and over.
 */
export function diff(reference: Buffer, target: Buffer): Buffer {
	const key = (b: Buffer, at: number) => (b.readUInt32LE(at) ^ Math.imul(b.readUInt32LE(at + 4), 0x9e3779b1)
		^ Math.imul(b.readUInt32LE(at + 8), 0x85ebca6b) ^ Math.imul(b.readUInt32LE(at + 12), 0xc2b2ae35)) >>> 0;
	const index = new Map<number, number>();
	for(let at = 0; at + Window <= reference.length; at += Step) {
		const k = key(reference, at);
		if(!index.has(k)) {
			index.set(k, at);
		}
	}
	const out = [varint(target.length)];
	let run = 0, last = 0;
	for(let at = 0; at + Window <= target.length;) {
		const found = index.get(key(target, at));
		if(found === undefined || reference.compare(target, at, at + Window, found, found + Window) !== 0) {
			at++;
			continue;
		}
		let start = at, from = found, end = at + Window, to = found + Window;
		for(; start > run && from > 0 && target[start - 1] === reference[from - 1]; start--, from--) { /* grows the copy backwards */ }
		for(; end < target.length && to < reference.length && target[end] === reference[to]; end++, to++) { /* and forwards */ }
		const jump = from - last;
		out.push(varint(start - run), target.subarray(run, start), varint(end - start), varint(jump < 0 ? -2 * jump - 1 : 2 * jump));
		last = to;
		run = at = end;
	}
	out.push(varint(target.length - run), target.subarray(run));
	return Buffer.concat(out);
}

/** applies a {@link diff}, in the keeper and, written out as it stands, in the browser */
export function patch(reference: Uint8Array, delta: Uint8Array): Uint8Array {
	let at = 0, last = 0, written = 0;
	const read = () => {
		let n = 0;
		for(let scale = 1; ; scale *= 128) {
			const byte = delta[at++];
			n += (byte % 128) * scale;
			if(byte < 128) {
				return n;
			}
		}
	};
	const out = new Uint8Array(read());
	while(at < delta.length) {
		const run = read();
		out.set(delta.subarray(at, at + run), written);
		at += run;
		written += run;
		if(at >= delta.length) {
			break;
		}
		const length = read(), jump = read();
		last += jump % 2 === 1 ? -(jump + 1) / 2 : jump / 2;
		out.set(reference.subarray(last, last + length), written);
		written += length;
		last += length;
	}
	return out;
}

/** fetches the playground the site serves, patches it into the kept one, checks it is that, and shows it */
export const Loader = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>flowR &middot; playground</title></head>
<body><p id="state">loading the playground of an earlier release...</p><script>
${patch.toString()}
const bytes = async(url, init) => {
	const got = await fetch(url, init);
	if(!got.ok) throw new Error(url + ' answered ' + got.status);
	const data = new Uint8Array(await got.arrayBuffer());
	return data[0] === 0x1f && data[1] === 0x8b ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) : data;
};
const hex = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
const rebuild = async(file, want) => {
	const out = patch(await bytes('../../' + file, { cache: 'no-cache' }), await bytes(file + '.delta.gz'));
	if(await hex(out) !== want) throw new Error(file + ' is not the one of this release');
	return out;
};
fetch('delta.json').then(r => r.json()).then(async want => {
	const [page, bundle] = await Promise.all([rebuild('index.html', want['index.html']), rebuild('bundle.js', want['bundle.js'])]);
	document.open();
	document.write(new TextDecoder().decode(page).replace('src="bundle.js"', 'src="' + URL.createObjectURL(new Blob([bundle], { type: 'text/javascript' })) + '"'));
	document.close();
}).catch(e => document.getElementById('state').textContent = 'this playground could not be loaded: ' + e.message);
</script></body></html>
`;

const read = (dir: string): Files => Object.fromEntries(Files.map(file => [file, fs.readFileSync(path.join(dir, file))])) as Files;

/** the files of a playground as the site served them, put back together if it was kept as a difference */
function restore(dir: string, served: Files): Files {
	if(!fs.existsSync(path.join(dir, 'delta.json'))) {
		const files = read(dir);
		/* the page now lies two folders further down, which its links to the rest of the site have to climb */
		return { ...files, 'index.html': Buffer.from(files['index.html'].toString().replace(/\b(href|src)="\.\.\//g, '$1="../../../')) };
	}
	return Object.fromEntries(Files.map(file => [file, Buffer.from(patch(served[file], zlib.gunzipSync(fs.readFileSync(path.join(dir, `${file}.delta.gz`)))))])) as Files;
}

/** keeps a playground as the difference to the one the site serves now */
function keep(version: string, files: Files, guard: string, serving: Files): number {
	const into = path.join(Target, 'v', version);
	fs.mkdirSync(into, { recursive: true });
	for(const file of Files) {
		fs.writeFileSync(path.join(into, `${file}.delta.gz`), zlib.gzipSync(diff(serving[file], files[file]), { level: 9 }));
	}
	fs.writeFileSync(path.join(into, 'delta.json'), JSON.stringify(Object.fromEntries(Files.map(file => [file, sha(files[file])]))));
	fs.writeFileSync(path.join(into, 'index.html'), Loader);
	if(fs.existsSync(guard)) {
		fs.copyFileSync(guard, path.join(into, Guard));
	}
	return fs.readdirSync(into).reduce((sum, file) => sum + fs.statSync(path.join(into, file)).size, 0);
}

/** the releases tagged `playground/v<version>` to be kept whatever else is dropped */
function tagged(): Set<string> {
	try {
		return new Set(execSync('git ls-remote --tags origin "refs/tags/playground/*"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
			.split('\n').map(line => /refs\/tags\/playground\/v?([^\s^]+)$/.exec(line)?.[1]).filter(v => v !== undefined));
	} catch{
		return new Set();
	}
}

/**
 * Which of the `versions` the site keeps next to the `current` release, newest first: the newest patch of every other minor
 * release of the current major, the newest release of every earlier major, and whatever is `pinned`.
 */
export function keptReleases(versions: readonly string[], current: string | undefined, pinned: ReadonlySet<string>): string[] {
	const sorted = versions.filter(v => semver.valid(v) !== null).sort(semver.rcompare);
	const newestOf = (key: (v: string) => unknown) => (v: string) => sorted.find(other => key(other) === key(v)) === v;
	const minorOf = (v: string) => `${semver.major(v)}.${semver.minor(v)}`;
	return sorted.filter(v => pinned.has(v) || (current === undefined
		? newestOf(minorOf)(v)
		: semver.major(v) === semver.major(current) ? minorOf(v) !== minorOf(current) && newestOf(minorOf)(v) : semver.major(v) < semver.major(current) && newestOf(semver.major)(v)));
}

function main(previous: string | undefined): void {
	const serving = read(Target);
	const found = new Map<string, string>();
	if(previous !== undefined && fs.existsSync(path.join(previous, 'index.html'))) {
		for(const version of fs.existsSync(path.join(previous, 'v')) ? fs.readdirSync(path.join(previous, 'v')) : []) {
			found.set(version, path.join(previous, 'v', version));
		}
		const release = releaseOf(fs.readFileSync(path.join(previous, 'index.html')));
		if(release !== undefined) {
			found.set(release, previous);
		}
	}
	const kept = keptReleases([...found.keys()], releaseOf(serving['index.html']), tagged());
	/* what is kept so far is read before it is replaced, against the playground the site served until now */
	const served = previous !== undefined && kept.length > 0 ? read(previous) : serving;
	const restored = kept.map(v => [v, restore(found.get(v) as string, served), path.join(found.get(v) as string, Guard)] as const);
	fs.rmSync(path.join(Target, 'v'), { recursive: true, force: true });
	const sizes = restored.map(([v, files, guard]) => `${v} (${Math.round(keep(v, files, guard, serving) / 1024)} kB)`);
	fs.mkdirSync(path.join(Target, 'v'), { recursive: true });
	fs.writeFileSync(path.join(Target, 'v', 'index.json'), JSON.stringify(kept));
	console.log(`  kept the playgrounds of ${sizes.length > 0 ? sizes.join(', ') : 'no earlier release'}`);
}

if(require.main === module) {
	main(process.argv[2]);
}
