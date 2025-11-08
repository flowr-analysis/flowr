import { assert, describe, test } from 'vitest';
import { requestFromFile, requestFromText } from '../../../../src/util/formats/adapter';
import { restoreBlocksWithoutMd,  isRCodeBlock, type RmdInfo } from '../../../../src/util/formats/adapters/rmd-adapter';
import { Node } from 'commonmark';
import type { RParseRequestFromText } from '../../../../src/r-bridge/retriever';

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


		test.each([
			[ // #1 - simple
				[
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 2,
							col:  1
						}
					}
				],
				2,
				'Hello World\nHello World\n'
			],
			[ // #2 - new lines at end
				[
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 2,
							col:  1
						}
					}
				],
				4,
				'Hello World\nHello World\n\n\n'
			],
			[ // #3 - new lines between and at end
				[
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  'dont care',
						code:     'Hello World\n',
						startpos: {
							line: 5,
							col:  1
						}
					}
				],
				7,
				'Hello World\n\n\n\nHello World\n\n\n'
			]
		])('resotre block (%#)', (blocks, lines, expected) => {
			const restored = restoreBlocksWithoutMd(blocks, lines);
			assert.equal(restored, expected);
		});
	});


	test('load simple', () => {
		const data = requestFromFile('test/testfiles/notebook/example.Rmd');
		assert.deepEqual(data, {
			request: 'text',
			content: '\n\n\n\n\n\n\n\n\n\n' +
                  'test <- 42\n' +
                  'cat(test)\n\n\n\n\n' +
                  'x <- "Hello World"\n\n\n\n\n' +
                  '  cat("Hi")\n\n\n\n\n\n' +
                  '#| cache=FALSE\n' +
                  'cat(test)\n\n\n\n\n\n\n\n\n\n'  +
				  'v <- c(1,2,3)\n\n\n\n',
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
					},
					{
						code:    'v <- c(1,2,3)\n',
						options: 'test'
					}
				],
				options: { title: 'Sample Document', output: 'pdf_document' }
			}
		} satisfies RParseRequestFromText<RmdInfo>);
	});

	test('load from str', () => {
		const data = requestFromText(`---
test: 1
---

# Hello World
		
\`\`\`{r}
print(42)
\`\`\`
		`, 'Rmd');

		assert.deepEqual(data, {
			content: '\n\n\n\n\n\n\nprint(42)\n\n',
			info:    {
				blocks: [
					{
						code:    'print(42)\n',
						options: '',
					},
				],
				options: {
					test: 1,
				},
				'type': 'Rmd',
			},
			request: 'text',
		} satisfies RParseRequestFromText<RmdInfo>);
	});
});
