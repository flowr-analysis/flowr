import { assert, describe, test } from 'vitest';
import { Node } from 'commonmark';
import {
	FlowrRMarkdownFile,
	isRCodeBlock,
	restoreBlocksWithoutMd
} from '../../../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { FlowrInlineTextFile, FlowrTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';

describe('rmd', () => {

	test('load with child', () => {
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
		const file = FlowrRMarkdownFile.from(new FlowrTextFile('test/testfiles/notebook/parent.Rmd'), ctx);
		const content = file.content();
		assert.equal(content, `
x <- "the cake is"




x <- paste(x, "a lie")

print(x)

`);
	});


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
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
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
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
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
						options:  new Map<string, string>(),
						code:     'Hello World\n',
						startpos: {
							line: 1,
							col:  1
						}
					},
					{
						options:  new Map<string, string>(),
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
		const data = FlowrRMarkdownFile.from(new FlowrTextFile('test/testfiles/notebook/example.Rmd'), new FlowrAnalyzerContext(FlowrConfig.default(), new Map()));
		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					code:     'test <- 42\ncat(test)\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 11,
					},
				},
				{
					code:     'x <- "Hello World"\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 17,
					},
				},
				{
					code:     '  cat("Hi")\n',
					options:  new Map<string, string>([['echo', 'FALSE']]),
					startpos: {
						col:  0,
						line: 22,
					},
				},
				{
					code:     '#| cache=FALSE\ncat(test)\n',
					options:  new Map<string, string>([['echo', 'FALSE'], ['cache', 'FALSE']]),
					startpos: {
						col:  0,
						line: 28,
					},
				},
				{
					code:     'v <- c(1,2,3)\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 39,
					},
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
		`), new FlowrAnalyzerContext(FlowrConfig.default(), new Map()));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					code:     'print(42)\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 8,
					},
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
		`), new FlowrAnalyzerContext(FlowrConfig.default(), new Map()));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					code:     'print(42)\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 3,
					}
				}
			],
			options: {}
		});
	});
});
