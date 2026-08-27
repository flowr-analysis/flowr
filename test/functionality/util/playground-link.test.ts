import { assert, describe, test } from 'vitest';
import { label } from '../_helper/label';
import { Playground, PlaygroundMark } from '../../../src/util/text/playground-link';
import { unpackFromUrl } from '../../../src/util/text/url-encoding';

/** The links the README and `:playground` hand out, and what the page reads back out of them. */
describe('Playground links', () => {
	const code = ['sum <- 0', 'w <- 7', 'cat("Sum:", sum, "\\n")'].join('\n');
	/** the fields of a link, as the page splits them apart again */
	const fields = (url: string): Record<string, string> =>
		Object.fromEntries(url.split('#')[1]?.split('&').map(field => {
			const at = field.indexOf('=');
			return [field.slice(0, at), decodeURIComponent(field.slice(at + 1))];
		}) ?? []);

	test(label('the script comes back out of the link', ['name-normal'], ['other']), () => {
		assert.strictEqual(unpackFromUrl(fields(Playground.link({ code })).c), code);
	});

	test(label('a link without anything to say is the page itself', ['name-normal'], ['other']), () => {
		assert.isFalse(Playground.link({}).includes('#'));
	});

	test(label('the marks ride along, lines first', ['name-normal'], ['other']), () => {
		assert.strictEqual(fields(Playground.link({ code, marks: ['3@sum', '1', 'lint:absolute-file-paths@1'] })).h,
			'1,3@sum,lint:absolute-file-paths@1');
	});

	test(label('a run of lines travels as one range, and back', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(PlaygroundMark.compress(['4', '2', '3', '2', '9']), ['2-4', '9']);
		assert.deepStrictEqual(PlaygroundMark.expand(['2-4', '9']), ['2', '3', '4', '9']);
		/* what a rule reported as a whole covers each of its findings, so those say nothing more */
		assert.deepStrictEqual(PlaygroundMark.compress(['lint:x@1', 'lint:x', 'dep:library@2']),
			['lint:x', 'dep:library@2']);
	});

	test(label('what the page cannot read back never enters the link', ['name-normal'], ['other']), () => {
		/* the type says as much, but a link may also be written by hand or come from an older page */
		const marks = ['nonsense', '@', ''] as unknown as PlaygroundMark[];
		assert.isUndefined(fields(Playground.link({ code, marks })).h);
		assert.deepStrictEqual(PlaygroundMark.expand(marks), []);
	});

	test(label('a criterion becomes the position the cursor opens on', ['name-normal'], ['other']), () => {
		/* `sum` stands at column 13 of `cat("Sum:", sum, "\n")`, and `Sum` inside the string is not it */
		assert.strictEqual(fields(Playground.link({ code, at: '3@sum' })).p, '3:13');
		assert.strictEqual(Playground.positionOf(code, '2@w'), '2:1');
		assert.strictEqual(Playground.positionOf(code, '1'), '1:1');
		assert.strictEqual(Playground.positionOf(code, '3:5'), '3:5');
		assert.isUndefined(Playground.positionOf(code, '3@nowhere'));
		assert.isUndefined(Playground.positionOf(code, '99@sum'));
	});

	test(label('the layout is one field, and an empty one is left out', ['name-normal'], ['other']), () => {
		assert.strictEqual(fields(Playground.link({ code, split: 40, forward: true })).v, '40,,>');
		assert.strictEqual(fields(Playground.link({ code, forward: true })).v, ',,>');
		assert.isUndefined(fields(Playground.link({ code })).v);
	});

	test(label('nothing in a link ends it, splits it, or reads back as something else', ['name-normal'], ['other']), () => {
		const url = Playground.link({ code: 'x <- 1 + 2 # a & b < c', config: ['solver.variables={"a":1}'] });
		const hash = url.split('#')[1];
		assert.notInclude(hash.slice(hash.indexOf('=')), '+', 'a plus would read back as a space');
		assert.isFalse(/[.,:;"')\]]$/.test(hash), 'a link may not end on what ends a sentence');
		assert.notInclude(hash, '<', 'an angle bracket ends the autolink a reader made of the address');
		assert.notInclude(hash, '>', 'an angle bracket ends the autolink a reader made of the address');
	});

	test(label('a configuration travels packed and reads back as it was', ['name-normal'], ['other']), () => {
		const config = ['sp.u.l.d=["software-has-license","problematic-inputs"]', 'e=[{"type":"tree-sitter","lax":true}]'];
		const url = Playground.link({ code, config });
		const hash = url.split('#')[1];
		assert.notMatch(hash.replace(/%[0-9A-Fa-f]{2}/g, ''), /[^A-Za-z0-9\-._~!$'()*,;:@/?=&]/,
			'a fragment carries nothing outside what a URI allows in one');
		assert.notInclude(hash, '%', 'a packed configuration needs no escaping at all');
		assert.deepStrictEqual(Playground.unpackConfig(fields(url).k), config);
	});

	test(label('a configuration an older link spelled out still reads', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(Playground.unpackConfig('sp.u.l.d=["a"];e=[{"lax":true}]'),
			['sp.u.l.d=["a"]', 'e=[{"lax":true}]']);
		assert.deepStrictEqual(Playground.unpackConfig(null), []);
	});

	test(label('the forward flag rides along escaped, and still reads back', ['name-normal'], ['other']), () => {
		const url = Playground.link({ code, forward: true });
		assert.notInclude(url, '>', 'a bare angle bracket is not a character a URI may carry');
		assert.include(url, '%3E');
		assert.strictEqual(fields(url).v, ',,>');
	});

	test(label('what is nobody\'s business never enters a report', ['name-normal'], ['other']), () => {
		const script = [
			'token <- "abc123"',
			'data <- read.csv("/home/someone/study/data.csv")',
			'mail <- "someone@example.org"',
			'clean <- data[data$value > 0, ]'
		].join('\n');
		const safe = Playground.sanitize(script);
		assert.notInclude(safe, 'abc123');
		assert.notInclude(safe, '/home/someone');
		assert.notInclude(safe, 'someone@example.org');
		/* what the report is about has to survive it */
		assert.include(safe, 'data.csv');
		assert.include(safe, 'clean <- data[data$value > 0, ]');
	});

	test(label('a script too long for a link gets none', ['name-normal'], ['other']), () => {
		assert.isDefined(Playground.reportLink(code));
		/* what compresses well still fits, so the script that must not is one without a pattern */
		let seed = 1;
		const noise = Array.from({ length: 6000 }, () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return String.fromCharCode(97 + seed % 26);
		}).join('');
		assert.isUndefined(Playground.reportLink(`x <- "${noise}"`));
	});

	test(label('a mark is what the page knows how to resolve', ['name-normal'], ['other']), () => {
		for(const mark of ['12', '12:5', '12-15', '12@sum', 'lint:absolute-file-paths', 'lint:absolute-file-paths@12',
			'dep:library', 'slice', 'repl', 'deps', 'lints']) {
			assert.isTrue(PlaygroundMark.isValid(mark), mark);
		}
		for(const mark of ['', 'sum', '@sum', 'twelve', '1,2']) {
			assert.isFalse(PlaygroundMark.isValid(mark), mark);
		}
	});
});
