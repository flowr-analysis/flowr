import { RString } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import { randomString } from '../../../src/util/random';
import { describe, assert, test } from 'vitest';

describe('(AST) Retriever', () => {
	describe('helper functions', () => {
		describe('removeRQuotes', () => {
			describe('extract', () => {
				const positive = (source: string): void => {
					describe(source === '' ? '<empty>' : `${source}`, () => {
						for(const letter of ['"', "'", '']) {
							const str = `${letter}${source}${letter}`;
							test(letter === '' ? '<none>' : `${letter}`, () => {
								assert.strictEqual(RString.unquote(str), source, `${str} should be ${source}`);
							});
						}
					});
				};
				positive('');
				positive('a');
				positive('ReallyLongWord');
			});
			test('should never throw', () => {
				for(let i = 1; i < 20; i++) {
					const randomStr = randomString(i);
					assert.doesNotThrow(() => RString.unquote(randomStr), undefined, `should not throw for ${randomStr}`);
				}
			});
		});
	});
});
