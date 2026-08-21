import { assert, describe, test } from 'vitest';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../_helper/label';

describe('NodeId', () => {
	describe('normalize', () => {
		test.each([['12', 12], ['-3', -3], [7, 7]] as const)('%s is the number %s', (id, expected) => {
			assert.strictEqual(NodeId.normalize(id), expected);
		});
		test.each(['', ' ', '\n', 'print', 'file.R-3', 'pkg:fn'])('%o stays the id it is', id => {
			assert.strictEqual(NodeId.normalize(id), id);
		});
	});

	describe('package functions', () => {
		test(label('round-trip through the built-in id', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual(NodeId.toPkgFn(NodeId.fromPkgFn('ggplot2', 'aes')), ['ggplot2', 'aes']);
		});
		test(label('a built-in without a package names no function', ['name-normal'], ['other']), () => {
			assert.isUndefined(NodeId.toPkgFn(NodeId.toBuiltIn('print')));
			assert.isUndefined(NodeId.toPkgFn(12));
			assert.isUndefined(NodeId.toPkgFn(undefined));
		});
	});
});
