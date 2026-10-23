import { describe, expect, test } from 'vitest';
import crypto from 'crypto';
import zlib from 'zlib';
import vm from 'vm';
import { diff, keptReleases, Loader, patch } from '../../../scripts/keep-playground-versions';

describe('kept playgrounds', () => {
	describe('which releases are kept', () => {
		const known = ['2.16.4', '2.16.3', '2.15.8', '2.15.7', '2.14.0', '1.9.2', '1.9.1', '1.8.5', '0.3.1'];
		test.each([
			['newest patch of every other minor, newest of every earlier major', known, '2.16.5', [], ['2.15.8', '2.14.0', '1.9.2', '0.3.1']],
			['a pinned release stays', known, '2.16.5', ['1.8.5', '2.15.7'], ['2.15.8', '2.15.7', '2.14.0', '1.9.2', '1.8.5', '0.3.1']],
			['a new major keeps only the newest of the one before', known, '3.0.0', [], ['2.16.4', '1.9.2', '0.3.1']],
			['the release served is not kept twice', ['2.16.4', '2.15.8'], '2.16.4', [], ['2.15.8']],
			['without a release, every minor', known, undefined, [], ['2.16.4', '2.15.8', '2.14.0', '1.9.2', '1.8.5', '0.3.1']],
			['what is no release is ignored', ['_parts', 'index.json', '2.15.8'], '2.16.0', [], ['2.15.8']]
		])('%s', (_, versions, current, pinned, expected) => {
			expect(keptReleases(versions, current, new Set(pinned))).toEqual(expected);
		});
	});

	describe('a release is its difference to the one served', () => {
		const random = (n: number, seed: string) => Buffer.concat(Array.from({ length: Math.ceil(n / 32) }, (_, i) => crypto.createHash('sha256').update(`${seed}${i}`).digest())).subarray(0, n);
		const reference = Buffer.concat([random(50_000, 'a'), Buffer.from('const x = 1;'.repeat(2000)), random(30_000, 'b')]);
		test.each([
			['the same', reference],
			['edited in places', Buffer.concat([reference.subarray(0, 1000), Buffer.from('new'), reference.subarray(1200, 60_000), random(500, 'c'), reference.subarray(40_000)])],
			['moved around', Buffer.concat([reference.subarray(70_000), reference.subarray(0, 70_000)])],
			['nothing in common', random(20_000, 'd')],
			['shorter than a copy', Buffer.from('tiny')],
			['empty', Buffer.alloc(0)]
		])('%s', (_, target) => {
			const delta = diff(reference, target);
			expect(Buffer.from(patch(reference, delta)).equals(target)).toBe(true);
			if(target === reference) {
				expect(delta.length).toBeLessThan(16);
			}
		});
	});

	test('the page puts the release back together in the browser', async() => {
		const served = { 'index.html': Buffer.from('<!DOCTYPE html><a href="../img/x.svg">served</a><script src="bundle.js"></script>'), 'bundle.js': Buffer.from('served();'.repeat(500)) };
		const kept = { 'index.html': Buffer.from('<!DOCTYPE html><a href="../../../img/x.svg">kept</a><script src="bundle.js"></script>'), 'bundle.js': Buffer.from(`${'served();'.repeat(400)}kept();`) };
		const files = new Map<string, Buffer>([
			['../../index.html', served['index.html']], ['../../bundle.js', served['bundle.js']],
			['index.html.delta.gz', zlib.gzipSync(diff(served['index.html'], kept['index.html']))],
			['bundle.js.delta.gz', zlib.gzipSync(diff(served['bundle.js'], kept['bundle.js']))],
			['delta.json', Buffer.from(JSON.stringify({ 'index.html': crypto.createHash('sha256').update(kept['index.html']).digest('hex'), 'bundle.js': crypto.createHash('sha256').update(kept['bundle.js']).digest('hex') }))]
		]);
		let written = '';
		const blobs: Blob[] = [];
		const state = { textContent: '' };
		const script = /<script>([\s\S]*)<\/script>/.exec(Loader)?.[1] ?? '';
		await new Promise<void>(resolve => void vm.runInNewContext(script, {
			fetch:    (url: string) => Promise.resolve(files.has(url) ? new Response(new Uint8Array(files.get(url) as Buffer)) : new Response('', { status: 404 })),
			document: { open: () => undefined, write: (text: string) => written += text, close: resolve, getElementById: () => state },
			URL:      { createObjectURL: (blob: Blob) => `blob:${blobs.push(blob) - 1}` },
			Response, Blob, DecompressionStream, TextDecoder, Uint8Array, crypto:   globalThis.crypto
		}));
		expect(state.textContent).toBe('');
		expect(written).toContain('href="../../../img/x.svg">kept');
		expect(written).toContain('src="blob:0"');
		expect(await blobs[0].text()).toBe(kept['bundle.js'].toString());
	});
});
