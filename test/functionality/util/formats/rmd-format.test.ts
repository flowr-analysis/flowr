import { describe, test } from 'vitest';
import { readFile } from '../../../../src/util/formats/adapter';

describe('rmd', () => { 
	test('simple', () => {
		const out = readFile('test/testfiles/example.Rmd');
		console.log(out);
	});
});
