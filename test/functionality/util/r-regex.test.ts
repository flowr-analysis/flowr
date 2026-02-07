import { parseRRegexPattern } from '../../../src/util/r-regex';
import { assert, describe, test } from 'vitest';

describe('R Regex Pattern Parsing', () => {
	function chk(input: string, expected: string) {
		test(input, () => {
			const rgx = parseRRegexPattern(input);
			assert.strictEqual(rgx.source, expected);
		});
	}
	chk('[[:alpha:]]+', '[A-Za-z]+');
	chk('^[[:digit:]]{3}-[[:digit:]]{2}-[[:digit:]]{4}$', '^[0-9]{3}-[0-9]{2}-[0-9]{4}$');
	chk('file_[[:alnum:]]+\\.txt', 'file_[A-Za-z0-9]+\\.txt');
	chk('data[:space:]*end', 'data\\s*end');
	chk('hex[a[:xdigit:]b]{2}', 'hex[aA-Fa-f0-9b]{2}');
	chk('ascii[[:ascii:]]+', 'ascii[\x00-\x7F]+');
	chk('*.IData', '.*.IData');
});