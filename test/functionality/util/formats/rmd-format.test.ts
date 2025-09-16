import { assert, describe, test } from 'vitest';
import { readFileWithAdapter } from '../../../../src/util/formats/adapter';
import type { RmdInfo } from '../../../../src/util/formats/adapters/rmd-adapter';
import type { FileData } from '../../../../src/util/formats/adapter-format';

describe('rmd', () => { 
	test('simple', () => {
		const data = readFileWithAdapter('test/testfiles/example.Rmd');

		assert.deepEqual(data,{
			type: '.Rmd',
			code: 'test <- 42\n' +
                  'cat(test)\n' +
                  '\n' +
                  'test\n' +
                  'x <- "Hello World"\n' +
                  '\n' +
                  'cat("Hi")\n' +
                  '\n' +
                  '#| cache=FALSE\n' +
                  'cat(test)\n',
			blocks: [
				{ code: 'test <- 42\ncat(test)\n', options: '' },
				{ code: 'test', options: '' },
				{ code: 'x <- "Hello World"\n', options: 'abc' },
				{ code: 'cat("Hi")\n', options: 'ops, echo=FALSE' },
				{ code: '#| cache=FALSE\ncat(test)\n', options: 'echo=FALSE, cache=FALSE' }
			],
			options: { title: 'Sample Document', output: 'pdf_document' }
		} as FileData<RmdInfo>);
	});
});
