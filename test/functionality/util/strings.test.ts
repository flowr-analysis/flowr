import {
	dropRawStringSurround,
	longestCommonPrefix,
	startAndEndsWith,
	withoutWhitespace
} from '../../../src/util/text/strings';
import { describe, assert, test } from 'vitest';

describe('Strings', () => {
	describe('startAndEndsWith', () => {
		describe('positive', () => {
			const positive = (str: string, letter: string): void => {
				test(`${str} with ${letter}`, () => {
					assert.isTrue(startAndEndsWith(str, letter), `${str} should start and end with ${letter}`);
				});
			};
			positive('""', '"');
			positive('AnnA', 'A');
			positive('PalindromeemordnilaP', 'P');
		});
		describe('negative', () => {
			const negative = (str: string, letter: string): void => {
				test(`${str} with ${letter}`, () => {
					assert.isFalse(startAndEndsWith(str, letter), `${str} should not start and end with ${letter}`);
				});
			};
			negative('Anna', 'A');
			negative('annA', 'A');
			negative('Walter', 'W');
			negative('Timo', 'o');
		});
	});
	describe('withoutWhitespace', () => {
		test('should remove all whitespace', () => {
			assert.equal(withoutWhitespace('a b c'), 'abc');
			assert.equal(withoutWhitespace('abc'), 'abc');
			assert.equal(withoutWhitespace('a\nb\tc'), 'abc');
			assert.equal(withoutWhitespace('a\nb\tc '), 'abc');
		});
	});
	describe('longestCommonPrefix', () => {
		const positive = (strings: string[], expected: string): void => {
			test(`should be ${expected} for ${JSON.stringify(strings)}`, () => {
				assert.equal(longestCommonPrefix(strings), expected);
			});
		};
		positive([], '');
		positive(['abc'], 'abc');
		positive(['abc', 'abc'], 'abc');
		positive(['abc', 'abcde'], 'abc');
		positive(['abc', 'abcde', 'abcd'], 'abc');
		positive(['abc', 'abcde', 'x', 'abcde'], '');
	});
	describe('dropRawStringSurround', () => {
		const positive = (input: string, expected: string): void => {
			test(`should drop surrounding quotes from "${input}" to "${expected}"`, () => {
				assert.equal(dropRawStringSurround(input), expected);
			});
		};
		const negative = (input: string): void => {
			test(`should not drop surrounding quotes from "${input}"`, () => {
				assert.equal(dropRawStringSurround(input), input);
			});
		};
		for(const [open, close] of [['(', ')'], ['[', ']'], ['{','}']] as const) {
			describe(open + ' and ' + close, () => {
				for(let dashes = 0; dashes < 5; ++dashes) {
					describe(`with ${'-'.repeat(dashes)}`, () => {
						for(const string of ['x', 'longstring', '[xii', '  ', ' x', 'x ', 'x-']) {
							describe(`with ${string}`, () => {
								positive(`${'-'.repeat(dashes)}${open}${string}${close}${'-'.repeat(dashes)}`, string);
								if(dashes > 0) {
									negative(`${'-'.repeat(dashes)}${open}${string}${close}`);
								}
								negative(`${'-'.repeat(dashes)}${open}${string}${'-'.repeat(dashes)}`);
								negative(`${'-'.repeat(dashes)}${string}${'-'.repeat(dashes)}`);
							});
						}
					});
				}
			});
		}

	});
});
