import https from 'https';
import net from 'net';
import type { IncomingMessage } from 'http';
import type { FetchBytes } from './remote-sources';
import { SecureMode } from '../../../util/secure-mode';

/** an archive bigger than its source was allowed to be */
export class TooLargeError extends Error {
	public constructor(url: string, max: number) {
		super(`${url} is larger than ${Math.round(max / 1024 / 1024)} MiB`);
		this.name = 'TooLargeError';
	}
}

/** a URL the on-demand fetch refuses: anything but `https`, or a host on the local machine or network */
export class RefusedUrlError extends Error {
	public constructor(url: string, why: string) {
		super(`refusing ${url}: ${why}`);
		this.name = 'RefusedUrlError';
	}
}

/** whether `host` is this machine or an address of a private network, which a redirect must never lead to */
export function isLocalHost(host: string): boolean {
	const bare = host.replace(/^\[|\]$/g, '').toLowerCase();
	if(bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.local') || bare.endsWith('.internal')) {
		return true;
	}
	if(net.isIPv4(bare)) {
		const [a, b] = bare.split('.').map(Number);
		return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
	}
	if(net.isIPv6(bare)) {
		return bare === '::' || bare === '::1' || /^(fc|fd|fe8|fe9|fea|feb)/.test(bare) || bare.startsWith('::ffff:');
	}
	return false;
}

/** the URL, if the fetch may go there. `trusted` hosts (the mirrors a trusted configuration names) may be local */
export function checkedUrl(url: string, trusted: ReadonlySet<string> = new Set()): URL {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch{
		throw new RefusedUrlError(url, 'no URL');
	}
	if(parsed.protocol !== 'https:') {
		throw new RefusedUrlError(url, 'only https is allowed');
	}
	if(parsed.username || parsed.password) {
		throw new RefusedUrlError(url, 'no credentials in URLs');
	}
	if(isLocalHost(parsed.hostname) && !trusted.has(parsed.host)) {
		throw new RefusedUrlError(url, 'a local or private host');
	}
	return parsed;
}

const IdleTimeoutMs = 30_000;
const MaxRedirects = 5;

function get(url: string, redirects: number, trusted: ReadonlySet<string>): Promise<IncomingMessage | undefined> {
	SecureMode.guard('network access', url);
	const target = checkedUrl(url, trusted);
	return new Promise((resolve, reject) => {
		/* no token or cookie ever goes out: these are public sources */
		const req = https.get(target, { headers: { 'User-Agent': 'flowr', Accept: '*/*' } }, res => {
			const status = res.statusCode ?? 0;
			if(status >= 300 && status < 400 && res.headers.location) {
				res.resume();
				if(redirects <= 0) {
					reject(new Error(`GET ${url}: too many redirects`));
					return;
				}
				/* every hop is checked again, so a redirect cannot lead to plain http or into the local network */
				get(new URL(res.headers.location, target).toString(), redirects - 1, trusted).then(resolve, reject);
			} else if(status >= 200 && status < 300) {
				resolve(res);
			} else {
				res.resume();
				if(status === 404 || status === 410) {
					resolve(undefined);
				} else {
					reject(new Error(`GET ${url} -> HTTP ${status}`));
				}
			}
		});
		req.setTimeout(IdleTimeoutMs, () => req.destroy(new Error(`GET ${url} -> no data for ${IdleTimeoutMs / 1000}s`)));
		req.on('error', reject);
	});
}

/**
 * {@link FetchBytes} over HTTPS, see {@link checkedUrl}. A 404 (or 410) means the server does not have it.
 * @param trusted - the hosts (with port) that may be local, as a company mirror is
 */
export function httpsFetcher(trusted: ReadonlySet<string> = new Set()): FetchBytes {
	return async(url, maxBytes) => {
		const res = await get(url, MaxRedirects, trusted);
		if(res === undefined) {
			return undefined;
		}
		const announced = Number(res.headers['content-length'] ?? NaN);
		if(announced > maxBytes) {
			res.destroy();
			throw new TooLargeError(url, maxBytes);
		}
		const chunks: Buffer[] = [];
		let total = 0;
		for await (const chunk of res) {
			total += (chunk as Buffer).length;
			if(total > maxBytes) {
				res.destroy();
				throw new TooLargeError(url, maxBytes);
			}
			chunks.push(chunk as Buffer);
		}
		return Buffer.concat(chunks);
	};
}
