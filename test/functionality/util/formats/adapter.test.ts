import { assert, describe, test } from 'vitest';
import { inferFileType } from '../../../../src/util/formats/adapter';

describe('format adapter', () => {
	test.each([
		['.R', 'R'],
		['.r', 'R'],
		['.rmd', 'Rmd'],
		['.Rmd', 'Rmd'],
		['.whoknows', 'R'],
	])('inferFileType(\'%s\') -> %s', (ext, expected) => {
		assert.equal(inferFileType({
			request: 'file',
			content: `/some/file${ext}`
		}), expected);
	});
});