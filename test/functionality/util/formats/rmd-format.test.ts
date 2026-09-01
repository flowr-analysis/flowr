import { assert, describe, test } from 'vitest';
import { Node } from 'commonmark';
import {
	FlowrRMarkdownFile,
	isRCodeBlock,
	parseRMarkdownFile,
	restoreBlocksWithoutMd
} from '../../../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { FlowrInlineTextFile, FlowrTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';

describe('rmd', () => {

	test('load with child', () => {
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default());
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
		const data = FlowrRMarkdownFile.from(new FlowrTextFile('test/testfiles/notebook/example.Rmd'), new FlowrAnalyzerContext(FlowrConfig.default()));
		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					header:   '{r}',
					code:     'test <- 42\ncat(test)\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 11,
					},
				},
				{
					header:   '{r abc}',
					code:     'x <- "Hello World"\n',
					options:  new Map<string, string>(),
					startpos: {
						col:  0,
						line: 17,
					},
				},
				{
					header:   '{r ops, echo=FALSE}',
					code:     '  cat("Hi")\n',
					options:  new Map<string, string>([['echo', 'FALSE']]),
					startpos: {
						col:  0,
						line: 22,
					},
				},
				{
					header:   '{r, echo=FALSE}',
					code:     '#| cache=FALSE\ncat(test)\n',
					options:  new Map<string, string>([['echo', 'FALSE'], ['cache', 'FALSE']]),
					startpos: {
						col:  0,
						line: 28,
					},
				},
				{
					header:   '{r, test}',
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
		`), new FlowrAnalyzerContext(FlowrConfig.default()));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					header:   '{r}',
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
		`), new FlowrAnalyzerContext(FlowrConfig.default()));

		assert.deepEqual({ blocks: data.rmd.blocks, options: data.rmd.options }, {
			blocks: [
				{
					code:     'print(42)\n',
					options:  new Map<string, string>(),
					header:   '{r}',
					startpos: {
						col:  0,
						line: 3,
					}
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
		`), new FlowrAnalyzerContext(FlowrConfig.default()));

		assert.deepEqual(data.executableCells, [
			{
				header:   '{r}',
				code:     'print(42)\n',
				options:  new Map<string, string>(),
				startpos: {
					col:  0,
					line: 12,
				}
			}
		]);
	});

	test('merged content skips eval=FALSE blocks but keeps line numbers', () => {
		const data = FlowrRMarkdownFile.from(new FlowrInlineTextFile('foo.Rmd', `\`\`\`{r, eval=FALSE}
stop("no")
\`\`\`

\`\`\`{r}
write.csv(1, "out.csv")
\`\`\`
`), new FlowrAnalyzerContext(FlowrConfig.default()));

		assert.equal(data.content(), '\n'.repeat(5) + 'write.csv(1, "out.csv")\n\n');
	});

	test('merged content skips quarto-style eval: false', () => {
		const data = FlowrRMarkdownFile.from(new FlowrInlineTextFile('foo.qmd', `\`\`\`{r}
#| eval: false
stop("no")
\`\`\`

\`\`\`{r}
write.csv(1, "out.csv")
\`\`\`
`), new FlowrAnalyzerContext(FlowrConfig.default()));

		assert.equal(data.content(), '\n'.repeat(6) + 'write.csv(1, "out.csv")\n\n');
	});

	describe('global chunk options', () => {
		/** the code of every chunk that survives the eval resolution */
		const executed = (content: string) => FlowrRMarkdownFile.from(
			new FlowrInlineTextFile('foo.Rmd', content), new FlowrAnalyzerContext(FlowrConfig.default())
		).executableCells.map(c => c.code.trim());

		test('quarto frontmatter execute defaults', () => {
			assert.deepEqual(executed(`---
title: Sample
execute:
  eval: false
---

\`\`\`{r}
skipped()
\`\`\`

\`\`\`{r, eval=TRUE}
kept()
\`\`\`
`), ['kept()']);
		});

		test('rmarkdown frontmatter knitr opts_chunk defaults', () => {
			assert.deepEqual(executed(`---
title: Sample
knitr:
  opts_chunk:
    eval: false
---

\`\`\`{r}
skipped()
\`\`\`

\`\`\`{r}
#| eval: true
kept()
\`\`\`
`), ['#| eval: true\nkept()']);
		});
	});

	describe('error tolerant chunks', () => {
		const merge = (content: string) => FlowrRMarkdownFile.from(
			new FlowrInlineTextFile('foo.Rmd', content), new FlowrAnalyzerContext(FlowrConfig.default())
		).content().toString();

		test.each([
			['{r, error=TRUE}'],
			['{r, error=T}'],
			['{r}\n#| error: true']
		])('an error=TRUE chunk keeps the rest of the document (%s)', header => {
			const merged = merge(`\`\`\`${header}
stop("no")
\`\`\`

\`\`\`{r}
write.csv(1, "out.csv")
\`\`\`
`);
			assert.include(merged, 'tryCatch({');
			assert.include(merged, '}, error = function(e) NULL)');
			assert.include(merged, 'write.csv(1, "out.csv")');
		});

		test('a plain chunk is left alone', () => {
			assert.notInclude(merge(`\`\`\`{r}
stop("no")
\`\`\`
`), 'tryCatch');
		});

		test('wrapping does not shift the lines of later chunks', () => {
			const content = `\`\`\`{r, error=TRUE}
stop("no")
\`\`\`

\`\`\`{r}
write.csv(1, "out.csv")
\`\`\`
`;
			const wrapped = merge(content).split('\n');
			const plain = merge(content.replace(', error=TRUE', '')).split('\n');
			assert.equal(wrapped.length, plain.length);
			assert.equal(wrapped.indexOf('write.csv(1, "out.csv")'), plain.indexOf('write.csv(1, "out.csv")'));
		});
	});

	describe('quarto include shortcodes', () => {
		test('an include is resolved like a knitr child', () => {
			const ctx = new FlowrAnalyzerContext(FlowrConfig.default());
			const file = FlowrRMarkdownFile.from(new FlowrTextFile('test/testfiles/notebook/include-parent.qmd'), ctx);
			assert.equal(file.content(), '\n\n\n\n\nx <- "the cake is"\n\n\n\nx <- paste(x, "a lie")\n\nprint(x)\n\n');
		});

		test.each([
			['{{< include child.Rmd >}}', 'child.Rmd'],
			['{{< include "child.Rmd" >}}', 'child.Rmd'],
			['{{<include child.Rmd>}}', 'child.Rmd'],
			['text {{< include sub/child.Rmd >}} more', 'sub/child.Rmd']
		])('the shortcode %s yields a child block', (line, expected) => {
			const blocks = parseRMarkdownFile(`${line}\n`).blocks;
			assert.deepEqual(blocks.map(b => b.options.get('child')), [expected]);
		});

		test('blocks stay ordered by line', () => {
			const blocks = parseRMarkdownFile(`\`\`\`{r}
first()
\`\`\`

{{< include child.Rmd >}}

\`\`\`{r}
last()
\`\`\`
`).blocks;
			assert.deepEqual(blocks.map(b => b.startpos.line), [2, 5, 8]);
		});
	});

	describe('yaml cell options', () => {
		const optionsOf = (content: string) => parseRMarkdownFile(content).blocks[0].options;

		test('a block scalar spanning several lines is parsed', () => {
			assert.deepEqual([...optionsOf(`\`\`\`{r}
#| fig-cap: |
#|   A long caption
#|   that continues
#| eval: false
x <- 1
\`\`\`
`)], [['fig-cap', 'A long caption\nthat continues\n'], ['eval', 'false']]);
		});

		test('quarto dashed option names survive', () => {
			assert.deepEqual(optionsOf(`\`\`\`{r}
#| out-width: 50%
#| fig-align: center
x <- 1
\`\`\`
`).get('out-width'), '50%');
		});

		test('knitr key=value behind the marker still works', () => {
			assert.deepEqual([...optionsOf(`\`\`\`{r}
#| cache=FALSE
x <- 1
\`\`\`
`)], [['cache', 'FALSE']]);
		});
	});
});
