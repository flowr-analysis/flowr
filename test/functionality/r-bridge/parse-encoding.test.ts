import { describe, expect, test } from 'vitest';
import { prepareParsedData } from '../../../src/r-bridge/lang-4.x/ast/parser/json/format';
import { label } from '../_helper/label';

/**
 * Under a non-UTF-8 R locale, `getParseData`'s `encodeString` escapes non-ASCII bytes as octal (`\303\264`) or hex
 * (`\xc3`), which are not valid JSON and used to crash {@link prepareParsedData} (the benchmark's
 * `failed to reconstruct/re-parse` spike). The reader now decodes these back to UTF-8, independent of any locale.
 */
describe('parse-data reader tolerates locale-dependent R string escapes', () => {
	function textOf(data: string): string {
		const roots = prepareParsedData(data);
		return roots[0]?.text;
	}

	test(label('octal byte escapes decode to UTF-8', [], ['other']), () => {
		// exactly what R emits under a C locale for the string "Côte ’q’" (ô = C3 B4, ’ = E2 80 99)
		const data = '[1,6,1,21,4,0,"STR_CONST",true,"\\"C\\303\\264te \\342\\200\\231q\\342\\200\\231\\""]';
		expect(textOf(data)).toBe('"Côte ’q’"');
	});

	test(label('hex byte escapes decode to UTF-8', [], ['other']), () => {
		const data = '[1,1,1,4,1,0,"STR_CONST",true,"\\"C\\xc3\\xb4te\\""]';
		expect(textOf(data)).toBe('"Côte"');
	});

	test(label('an escaped backslash before digits is not misread as an octal escape', [], ['other']), () => {
		// R source text `"\\303"` (a literal backslash then 303) must round-trip unchanged
		const data = '[1,1,1,7,1,0,"STR_CONST",true,"\\"\\\\303\\""]';
		expect(textOf(data)).toBe('"\\303"');
	});

	test(label('plain ASCII data is unaffected', [], ['other']), () => {
		const data = '[1,1,1,1,1,0,"SYMBOL",true,"x"]';
		expect(textOf(data)).toBe('x');
	});
});
