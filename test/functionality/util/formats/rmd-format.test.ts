import { assert, describe, test } from 'vitest';
import { convertRequestWithAdapter } from '../../../../src/util/formats/adapter';
import { isRCodeBlock, type RmdInfo } from '../../../../src/util/formats/adapters/rmd-adapter';
import { Node } from 'commonmark';
import type { RParseRequestFromFile, RParseRequestFromText } from '../../../../src/r-bridge/retriever';

describe('rmd', () => {
	describe('utility functions', () => {
		test.each([
			/* Positive Cases           */
			['{r}',                 true],
			['{R}',                 true],
			['{r, some.options=5}', true],
			['{r, name, option=3}', true],
			['{r some.options=5}',  true],
			['{R name, option=3}',  true],
			/* Negative Cases           */
			['{rust}',              false],
			['{c}',                 false],
			['r',                   false],
		])('isRCodeBlock(\'%s\') -> %s', (str, expected) => {
			const node = new Node('code_block');
			node.literal = 'Test';
			node.info = str;
			assert.equal(isRCodeBlock(node), expected);
		});
	});
	

	test('load simple', () => {
		const data = convertRequestWithAdapter({
			request: 'file',
			content: 'test/testfiles/notebook/example.Rmd'
		} satisfies RParseRequestFromFile);
		assert.deepEqual(data, {
			request: 'text',
			content: '\n\n\n\n\n\n\n\n\n\n' +
                  'test <- 42\n' +
                  'cat(test)\n\n\n\n\n' +
                  'x <- "Hello World"\n\n\n\n\n' +
                  '  cat("Hi")\n\n\n\n\n\n' +
                  '#| cache=FALSE\n' +
                  'cat(test)\n',
			info: {
				type:   'Rmd',
				blocks: [
					{
						code:    'test <- 42\ncat(test)\n',
						options: '',
					},
					{
						code:    'x <- "Hello World"\n',
						options: 'abc',
					},
					{
						code:    '  cat("Hi")\n',
						options: 'ops, echo=FALSE',
					},
					{
						code:    '#| cache=FALSE\ncat(test)\n',
						options: 'echo=FALSE, cache=FALSE',
					}
				],
				options: { title: 'Sample Document', output: 'pdf_document' }
			}
		} satisfies RParseRequestFromText<RmdInfo>);
	});


	// test('load sample', () => {
	// 	const data = convertRequestWithAdapter('test/testfiles/notebook/svm-rmarkdown-article-example.Rmd');
	// 	console.log(data);


	// });
});
