import { assert, describe, test } from 'vitest';
import { readFile } from '../../../../src/util/formats/adapter';
import type { RmdInfo } from '../../../../src/util/formats/adapters/rmd-adapter';
import type { FileData } from '../../../../src/util/formats/adapter-format';

describe('rmd', () => { 
	test('simple', () => {
		const data = readFile('test/testfiles/example.Rmd');

		assert.deepEqual(data, {
			type:   '.Rmd',
			code:   'test <- 42\n\ntest\nx <- "Hello World"\n\ncat("Hi")\n\n#| cache=FALSE\ncat("hi!")\n',
			blocks: [
				{ code: 'test <- 42\n', options: '' },
				{ code: 'test', options: '' },
				{ code: 'x <- "Hello World"\n', options: 'abc' },
				{ code: 'cat("Hi")\n', options: 'ops, echo=FALSE' },
				{
					code:    '#| cache=FALSE\ncat("hi!")\n',
					options: 'echo=FALSE, cache=FALSE'
				}
			],
			options: { title: 'Sample Document', output: 'pdf_document' }
		} as FileData<RmdInfo>);
	});
});
