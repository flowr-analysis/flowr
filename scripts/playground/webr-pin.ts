/**
 * What the playground expects webR's CDN to serve: the SHA-256 of every file of the pinned release, taken from
 * its npm tarball. The tarball is checked twice before it is read: the registry's ECDSA signature over
 * `name@version:integrity` against npm's public key pinned below, and the tarball's own SHA-512 against the
 * integrity pinned below. Changing the version means updating both.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export const WebRVersion = '0.6.0';
const Integrity = 'sha512-M2b8m3/ZBk7XMIR7LD97s5k/9jUla83Z0Hl4b+WnrK7XmSMpZdajCiP3XkSzHKHDUgscHKe+lVUvk3aym8q0bw==';
/* https://registry.npmjs.org/-/npm/v1/keys, the key npm signs packages with */
const NpmKeyId = 'SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U';
const NpmKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g==';

const Registry = `https://registry.npmjs.org/webr/${WebRVersion}`;
const Cache = path.join('node_modules', '.cache', 'flowr-playground', `webr-${WebRVersion}.tgz`);

export const WebRBase = `https://webr.r-wasm.org/v${WebRVersion}/`;

/* what the page loads at runtime: the rest of the package (types, maps, tests, its own repl) is never fetched */
const Wanted = /^package\/dist\/(?:webr\.js|webr-worker\.js|R\.js|R\.wasm|libRblas\.so|libRlapack\.so|vfs\/.+)$/;
/* the CDN serves the browser module, the tarball's `webr.js`, as `webr.mjs` (the tarball's `webr.mjs` is the one for node) */
const CdnName = (file: string) => file === 'webr.js' ? 'webr.mjs' : file;

function sha512(data: Buffer): string {
	return `sha512-${crypto.createHash('sha512').update(data).digest('base64')}`;
}

/** the registry vouches for the pinned integrity with npm's key, otherwise the download is not trusted */
async function verifySignature(): Promise<void> {
	const meta = await (await fetch(Registry)).json() as { dist: { integrity: string, signatures?: { keyid: string, sig: string }[] } };
	if(meta.dist.integrity !== Integrity) {
		throw new Error(`the registry lists ${meta.dist.integrity} for webR ${WebRVersion}, not the pinned integrity`);
	}
	const signature = meta.dist.signatures?.find(s => s.keyid === NpmKeyId);
	const key = crypto.createPublicKey({ key: Buffer.from(NpmKey, 'base64'), format: 'der', type: 'spki' });
	if(signature === undefined || !crypto.verify('sha256', Buffer.from(`webr@${WebRVersion}:${Integrity}`), key, Buffer.from(signature.sig, 'base64'))) {
		throw new Error(`the registry signature of webR ${WebRVersion} does not verify against npm's key`);
	}
}

/** the tarball, from the cache if it still matches the pinned integrity, otherwise downloaded and verified */
async function tarball(): Promise<Buffer> {
	if(fs.existsSync(Cache)) {
		const cached = fs.readFileSync(Cache);
		if(sha512(cached) === Integrity) {
			return cached;
		}
	}
	await verifySignature();
	const data = Buffer.from(await (await fetch(`https://registry.npmjs.org/webr/-/webr-${WebRVersion}.tgz`)).arrayBuffer());
	if(sha512(data) !== Integrity) {
		throw new Error(`the downloaded webR ${WebRVersion} does not match the pinned integrity`);
	}
	fs.mkdirSync(path.dirname(Cache), { recursive: true });
	fs.writeFileSync(Cache, data);
	return data;
}

/** the regular files of a tar archive, as npm writes them (ustar, with pax headers for long names) */
function* entries(tar: Buffer): Generator<{ name: string, data: Buffer }> {
	let longName: string | undefined;
	for(let at = 0; at + 512 <= tar.length;) {
		const header = tar.subarray(at, at + 512);
		if(header.every(b => b === 0)) {
			return;
		}
		const field = (from: number, to: number) => header.subarray(from, to).toString('utf8').replace(/\0.*$/s, '');
		const size = parseInt(field(124, 136).trim() || '0', 8);
		const type = field(156, 157);
		const data = tar.subarray(at + 512, at + 512 + size);
		at += 512 + Math.ceil(size / 512) * 512;
		if(type === 'x') {
			longName = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString('utf8'))?.[1];
			continue;
		}
		const prefix = field(345, 500);
		const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
		longName = undefined;
		if(type === '0' || type === '') {
			yield { name, data };
		}
	}
}

/**
 * The SHA-256 (base64) of every file the page loads from {@link WebRBase}, keyed by its path below it.
 * Throws when the package cannot be fetched or does not verify.
 */
export async function webRManifest(): Promise<Record<string, string>> {
	const manifest: Record<string, string> = {};
	for(const { name, data } of entries(zlib.gunzipSync(await tarball()))) {
		if(Wanted.test(name)) {
			manifest[CdnName(name.slice('package/dist/'.length))] = crypto.createHash('sha256').update(data).digest('base64');
		}
	}
	return manifest;
}
