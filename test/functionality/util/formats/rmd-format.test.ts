import { assert, describe, test } from 'vitest';
import { Node } from 'commonmark';
import {
	FlowrRMarkdownFile,
	isRCodeBlock,
	restoreBlocksWithoutMd
} from '../../../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { FlowrInlineTextFile, FlowrTextFile } from '../../../../src/project/context/flowr-file';

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
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
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
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
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
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						header:   '',
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
		const data = FlowrRMarkdownFile.from(new FlowrTextFile('test/testfiles/notebook/example.Rmd'));
		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					header:  '{r}',
					code:    'test <- 42\ncat(test)\n',
					options: new Map<string, string>(),
				},
				{
					header:  '{r abc}',
					code:    'x <- "Hello World"\n',
					options: new Map<string, string>(),
				},
				{
					header:  '{r ops, echo=FALSE}',
					code:    '  cat("Hi")\n',
					options: new Map<string, string>([['echo', 'FALSE']]),
				},
				{
					header:  '{r, echo=FALSE}',
					code:    '#| cache=FALSE\ncat(test)\n',
					options: new Map<string, string>([['echo', 'FALSE'], ['cache', 'FALSE']]),
				},
				{
					header:  '{r, test}',
					code:    'v <- c(1,2,3)\n',
					options: new Map<string, string>()
				}
			],
			options: { title: 'Sample Document', output: 'pdf_document' }
		});
	});

	test('load from str', () => {
		const data = FlowrRMarkdownFile.from(new FlowrInlineTextFile('foo.Rmd', `---
test: 1
---

# Hello World

\`\`\`{r}
print(42)
\`\`\`
		`));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					header:  '{r}',
					code:    'print(42)\n',
					options: new Map<string, string>(),
				},
			],
			options: {
				test: 1,
			}
		});
	});


	test('do not load with overridden engine', () => {
		const data = FlowrRMarkdownFile.from(new FlowrInlineTextFile('foo.Rmd', `
\`\`\`{r}
print(42)
\`\`\`


\`\`\`{r engine='python'}
print(42)
\`\`\`

\`\`\`{python}
print(42)
\`\`\`
		`));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					header:  '{r}',
					code:    'print(42)\n',
					options: new Map<string, string>()
				}
			],
			options: {}
		});
	});

	test('do not use block with eval=FALSE', () => {
		const data = FlowrRMarkdownFile.from(new FlowrInlineTextFile('foo.Rmd', `
\`\`\`{r eval=FALSE}
print(42)
\`\`\`


\`\`\`{r eval=F}
print(42)
\`\`\`

\`\`\`{r}
print(42)
\`\`\`
		`));

		assert.deepEqual(data.executableCells, [
			{
				header:  '{r}',
				code:    'print(42)\n',
				options: new Map<string, string>()
			}
		]);
	});
});
