import { assert, describe, test } from 'vitest';
import { label } from '../_helper/label';
import { fromBase64Url, packForUrl, toBase64Url, unpackFromUrl } from '../../../src/util/text/url-encoding';

/** What carries a script in the playground's own address, so a link is the example. */
describe('Url-safe text', () => {
	const roundTrips = [
		['a script', 'library(dplyr)\nfilter(df, id > 2)'],
		['what needs escaping in a url', 'x <- "a?b&c=d#e"\ny <- x'],
		['an operator and a comment', 'f <- function(a, b) a %in% b\n# comment\ny <- f(1:3, 2)'],
		['characters beyond ascii', 'x <- "héllo wörld ✓ 日本語"'],
		['nothing at all', '']
	] as const;

	test.each(roundTrips)('%s survives the round trip', (_what, text) => {
		assert.strictEqual(fromBase64Url(toBase64Url(text)), text);
	});

	test(label('what it writes needs no escaping in a url', ['name-normal'], ['other']), () => {
		for(const [, text] of roundTrips) {
			const encoded = toBase64Url(text);
			assert.match(encoded, /^[\w-]*$/, `${JSON.stringify(text)} encodes to url-safe characters`);
			assert.strictEqual(new URLSearchParams(`c=${encoded}`).get('c'), encoded, 'and a query keeps it as it is');
		}
	});

	test.each(roundTrips)('%s survives packing', (_what, text) => {
		assert.strictEqual(unpackFromUrl(packForUrl(text)), text);
	});

	test(label('packing never makes a link longer than plain base64 would', ['name-normal'], ['other']), () => {
		const texts = [...roundTrips.map(([, text]) => text), 'library(dplyr)\nfilter(df, value > 2)\nplot(df$id)', 'x <- 1\n'.repeat(60)];
		for(const text of texts) {
			assert.isAtMost(packForUrl(text).length, toBase64Url(text).length + 1, JSON.stringify(text.slice(0, 20)));
		}
	});

	test(label('a repeated script packs far below its plain length', ['name-normal'], ['other']), () => {
		const repeated = 'clean <- filter(raw, value > 2)\n'.repeat(40);
		assert.isBelow(packForUrl(repeated).length, toBase64Url(repeated).length / 2);
	});

	test(label('what packing writes needs no escaping in a url', ['name-normal'], ['other']), () => {
		for(const [, text] of roundTrips) {
			const packed = packForUrl(text);
			assert.strictEqual(new URLSearchParams(`c=${packed}`).get('c'), packed, 'a query keeps it as it is');
		}
	});

	test(label('a packed link someone edited by hand is refused', ['name-normal'], ['other']), () => {
		assert.isUndefined(unpackFromUrl('qwhat-is-this'), 'an unknown packing');
		assert.isUndefined(unpackFromUrl(''), 'nothing at all');
		assert.isUndefined(unpackFromUrl('znonsense!!'), 'nonsense where a compressed body should be');
	});

	test(label('a link someone edited by hand is refused', ['name-normal'], ['other']), () => {
		assert.isUndefined(fromBase64Url('not valid base64 !!'));
		assert.isUndefined(fromBase64Url('_-_-_-_'), 'nor a length that cannot decode');
		/* base64 of a byte sequence that is no utf-8 at all */
		assert.isUndefined(fromBase64Url('_w'), 'nor bytes that are not text');
	});
});
