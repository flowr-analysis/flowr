import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

/**
 * Base64 for the pages flowR ships, which run in a browser and therefore have `btoa`/`atob` rather than
 * node's `Buffer`. The url-safe pair is what lets the playground keep a script in its own address, so a
 * link is the example.
 */

/** bytes as base64 */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for(const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

/** text as base64 in the alphabet a url carries without escaping anything, padding dropped */
export function toBase64Url(text: string): string {
	return toBase64(new TextEncoder().encode(text)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** the inverse of {@link toBase64Url}, `undefined` for anything that is not what it produced */
export function fromBase64Url(text: string): string | undefined {
	try {
		const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
		return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
	} catch{
		return undefined;   /* a link someone edited by hand */
	}
}

/**
 * How {@link packForUrl} packed the text, kept as the first character so a link says how to read it back.
 * Compression wins on anything but the shortest texts, where its dictionary costs more than it saves, so
 * both are tried and the shorter one is what a link carries.
 */
const enum Packing {
	Compressed = 'z',
	Plain      = 't'
}

/** Text as short as it goes while staying a url: compressed when that helps, plain base64 when it does not. */
export function packForUrl(text: string): string {
	const plain = toBase64Url(text);
	if(text.length === 0) {
		return Packing.Plain + plain;
	}
	const compressed = compressToEncodedURIComponent(text);
	return compressed.length < plain.length ? Packing.Compressed + compressed : Packing.Plain + plain;
}

/** The inverse of {@link packForUrl}, `undefined` for anything it did not produce. */
export function unpackFromUrl(payload: string): string | undefined {
	const rest = payload.slice(1);
	try {
		switch(payload[0]) {
			case Packing.Compressed: return decompressFromEncodedURIComponent(rest) ?? undefined;
			case Packing.Plain:      return fromBase64Url(rest);
			default:                 return undefined;
		}
	} catch{
		return undefined;   /* a link someone edited by hand */
	}
}
