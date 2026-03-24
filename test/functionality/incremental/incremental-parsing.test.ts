import { assert, describe, it } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { printNormalizedAstToMermaid } from '../../../src/core/print/normalize-printer';


interface IncrementalParsingTestInput {
	path:            string;
	originalContent: string;
	updatedContent:  string;
}

interface SingleFileCase {
	name:  string;
	input: IncrementalParsingTestInput;
}

interface MultiFileCase {
	name:   string;
	inputs: IncrementalParsingTestInput[];
}


async function executeFullParse(inputs: readonly IncrementalParsingTestInput[]): Promise<NormalizedAst> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	for(const input of inputs) {
		const f = new FlowrInlineTextFile(input.path, input.updatedContent);
		analyzer.addFile(f);
		analyzer.addRequest({ request: 'file', content: input.path });
	}
	return (await analyzer.normalize());
}


async function executeIncrementalParse(inputs: readonly IncrementalParsingTestInput[]): Promise<NormalizedAst> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	const files = new Map<string, FlowrInlineTextFile>();
	for(const input of inputs) {
		const f = new FlowrInlineTextFile(input.path, input.originalContent);
		analyzer.addFile(f);
		analyzer.addRequest({ request: 'file', content: input.path });
		files.set(input.path, f);
	}
	await analyzer.normalize();

	for(const input of inputs) {
		const f = files.get(input.path);
		f?.updateInlineContent(input.updatedContent);
	}

	return (await analyzer.normalize());
}


async function executeAndCompareResults(inputs: readonly IncrementalParsingTestInput[]): Promise<void> {
	const fullParse = await executeFullParse(inputs);
	const incrementalParse = await executeIncrementalParse(inputs);

	const fullParseMermaid = printNormalizedAstToMermaid(fullParse);
	const incrementalParseMermaid = printNormalizedAstToMermaid(incrementalParse);

	assert.equal(fullParseMermaid, incrementalParseMermaid, 'The incremental parse result does not match the full parse result');
}

const lines = (...xs: string[]): string => xs.join('\n');

const file = (
	path: string,
	originalContent: string,
	updatedContent: string
): IncrementalParsingTestInput => ({
	path,
	originalContent,
	updatedContent
});

const singleFileCase = (
	name: string,
	originalContent: string,
	updatedContent: string
): SingleFileCase => ({
	name,
	input: {
		path: 'a.R',
		originalContent,
		updatedContent
	}
});

const singleFileNoOpCases: SingleFileCase[] = [
	singleFileCase('empty file', '', ''),
	singleFileCase('file with top-level content', 'x <- 42', 'x <- 42'),
	singleFileCase(
		'file with nested content',
		lines(
			'f <- function(x) {',
			'\ty <- x + 1',
			'\tprint(y)',
			'}'
		),
		lines(
			'f <- function(x) {',
			'\ty <- x + 1',
			'\tprint(y)',
			'}'
		)
	),
	singleFileCase('syntactically invalid file', 'print(', 'print(')
];

const singleFileInsertCases: SingleFileCase[] = [
	singleFileCase('one full line into an empty file', '', 'x <- 42'),
	singleFileCase(
		'one full line at the start of a file',
		'x <- 42',
		lines('y <- 21', 'x <- 42')
	),
	singleFileCase(
		'one full line in the middle of a file',
		lines('x <- 42', 'print(x)'),
		lines('x <- 42', 'x <- 2 * x', 'print(x)')
	),
	singleFileCase(
		'one full line at the end of a file',
		'x <- 42',
		lines('x <- 42', 'print(x)')
	),
	singleFileCase(
		'multiple lines into an empty file',
		'',
		lines('x <- 42', 'y <- 21', 'z <- 10')
	),
	singleFileCase(
		'multiple lines at different positions',
		lines('x <- 42', 'print(x)'),
		lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)')
	),
	singleFileCase('a single character inside a number', 'x <- 42', 'x <- 420'),
	singleFileCase('a single character inside an identifier', 'x <- 42', 'xy <- 42'),
	singleFileCase('a token inside an expression', 'x <- 1 + 2', 'x <- 1 + 2 + 3'),
	singleFileCase(
		'a token inside a nested argument list',
		'print(sum(1, 3))',
		'print(sum(1, 2, 3))'
	),
	singleFileCase('a trailing newline at end of file', 'x <- 42', 'x <- 42\n')
];

const singleFileRemoveCases: SingleFileCase[] = [
	singleFileCase('one full line such that the file becomes empty', 'x <- 42', ''),
	singleFileCase(
		'one full line at the start of a file',
		lines('y <- 21', 'x <- 42'),
		'x <- 42'
	),
	singleFileCase(
		'one full line in the middle of a file',
		lines('x <- 42', 'x <- 2 * x', 'print(x)'),
		lines('x <- 42', 'print(x)')
	),
	singleFileCase(
		'one full line at the end of a file',
		lines('x <- 42', 'print(x)'),
		'x <- 42'
	),
	singleFileCase(
		'multiple lines such that the file becomes empty',
		lines('x <- 42', 'y <- 21', 'z <- 10'),
		''
	),
	singleFileCase(
		'multiple lines at different positions',
		lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'),
		lines('x <- 42', 'print(x)')
	),
	singleFileCase('a single character from a number', 'x <- 420', 'x <- 42'),
	singleFileCase('a single character from an identifier', 'xy <- 42', 'x <- 42'),
	singleFileCase('a token from an expression', 'x <- 1 + 2 + 3', 'x <- 1 + 2'),
	singleFileCase(
		'a token from a nested argument list',
		'print(sum(1, 2, 3))',
		'print(sum(1, 3))'
	),
	singleFileCase('a trailing newline at end of file', 'x <- 42\n', 'x <- 42')
];

const singleFileReplaceCases: SingleFileCase[] = [
	singleFileCase(
		'one full line at the start of a file',
		lines('y <- 21', 'x <- 42'),
		lines('x <- 84', 'x <- 42')
	),
	singleFileCase(
		'one full line in the middle of a file',
		lines('x <- 42', 'x <- 2 * x', 'print(x)'),
		lines('x <- 42', 'y <- 21', 'print(x)')
	),
	singleFileCase(
		'one full line at the end of a file',
		lines('x <- 42', 'print(x)'),
		lines('x <- 42', 'x <- x * x')
	),
	singleFileCase(
		'a partially replaced multi-line region',
		lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'),
		lines('y <- 21', 'x <- 21', 'y <- y * y', 'print(x)', 'print(y)')
	),
	singleFileCase(
		'a fully replaced content',
		lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'),
		lines('z <- 10', 'z <- z + 32', 'print(z)')
	),
	singleFileCase('a single character in a number', 'x <- 42', 'x <- 43'),
	singleFileCase('an operator token', 'x <- 1 + 2', 'x <- 1 * 2'),
	singleFileCase(
		'an identifier token',
		lines('x <- 42', 'print(x)'),
		lines('value <- 42', 'print(value)')
	),
	singleFileCase(
		'part of a single line expression',
		'x <- (1 + 2) * 3',
		'x <- (1 + 20) * 3'
	),
	singleFileCase('whitespace only on a single line', 'x <- 42', 'x    <-    42'),
	singleFileCase(
		'whitespace only across multiple lines',
		lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'),
		lines('f <- function(x) {', '\t', '\ty <- x + 1', '\tprint(y)', '}')
	),
	singleFileCase('comment text', 'x <- 42 # old comment', 'x <- 42 # new comment'),
	singleFileCase('a string literal', 'msg <- "abc"', 'msg <- "abcd"'),
	singleFileCase('a UTF-8 string literal', 'msg <- "äöü"', 'msg <- "äöü€"'),
	singleFileCase('a UTF-8 comment', 'x <- 42 # gruß', 'x <- 42 # grüße €')
];

const singleFileSyntaxTransitionCases: SingleFileCase[] = [
	singleFileCase(
		'valid to invalid by removing the right-hand side of an assignment',
		'x <- 42',
		'x <-'
	),
	singleFileCase(
		'valid to invalid by removing a closing brace',
		lines(
			'f <- function(x) {',
			'\tprint(x)',
			'}'
		),
		lines(
			'f <- function(x) {',
			'\tprint(x)'
		)
	),
	singleFileCase(
		'valid to invalid by removing a closing parenthesis',
		'print(sum(1, 2))',
		'print(sum(1, 2)'
	),
	singleFileCase(
		'invalid to valid by completing an assignment',
		'x <-',
		'x <- 42'
	),
	singleFileCase(
		'invalid to valid by restoring a closing brace',
		lines(
			'f <- function(x) {',
			'\tprint(x)'
		),
		lines(
			'f <- function(x) {',
			'\tprint(x)',
			'}'
		)
	),
	singleFileCase(
		'invalid to valid by restoring a closing parenthesis',
		'print(sum(1, 2)',
		'print(sum(1, 2))'
	),
	singleFileCase(
		'invalid to invalid across different incomplete forms',
		'print(',
		'function(,'
	)
];

const singleFileNestedStructureCases: SingleFileCase[] = [
	singleFileCase(
		'inside a function body',
		lines(
			'f <- function(x) {',
			'\ty <- x + 1',
			'\tprint(y)',
			'}'
		),
		lines(
			'f <- function(x) {',
			'\ty <- x * 2',
			'\tprint(y)',
			'}'
		)
	),
	singleFileCase(
		'inside an if branch',
		lines(
			'if (x > 0) {',
			'\ty <- 1',
			'}'
		),
		lines(
			'if (x > 0) {',
			'\ty <- 1',
			'\tz <- 2',
			'}'
		)
	),
	singleFileCase(
		'inside a for loop body',
		lines(
			'for (i in 1:3) {',
			'\tprint(i)',
			'}'
		),
		lines(
			'for (i in 1:3) {',
			'\ttotal <- i + 1',
			'\tprint(total)',
			'}'
		)
	),
	singleFileCase(
		'inside a nested argument list',
		'print(sum(1, 2, 3))',
		'print(sum(1, 20, 3))'
	),
	singleFileCase(
		'inside nested brackets and subexpressions',
		'x <- list(a = list(b = 1))',
		'x <- list(a = list(b = 2))'
	)
];

const repeatedUpdatePairwiseCases: SingleFileCase[] = [
	singleFileCase(
		'sequence step 1: empty file to initial assignment',
		'',
		'x <- 1'
	),
	singleFileCase(
		'sequence step 2: initial assignment to character-level update',
		'x <- 1',
		'x <- 10'
	),
	singleFileCase(
		'sequence step 3: character-level update to added statement',
		'x <- 10',
		lines('x <- 10', 'print(x)')
	),
	singleFileCase(
		'sequence step 4: added statement to nested function',
		lines('x <- 10', 'print(x)'),
		lines(
			'f <- function() {',
			'\tprint(x)',
			'}',
			'f()'
		)
	),
	singleFileCase(
		'sequence step 5: nested function to temporarily invalid syntax',
		lines(
			'f <- function() {',
			'\tprint(x)',
			'}',
			'f()'
		),
		lines(
			'f <- function() {',
			'\tprint(x)',
			'f()'
		)
	),
	singleFileCase(
		'sequence step 6: temporarily invalid syntax back to valid syntax',
		lines(
			'f <- function() {',
			'\tprint(x)',
			'f()'
		),
		lines(
			'f <- function() {',
			'\tprint(x)',
			'}',
			'f()'
		)
	)
];

const multiFileCases: MultiFileCase[] = [
	{
		name:   'editing only the first file while the second file stays unchanged',
		inputs: [
			file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'x <- x + 1', 'print(x)')),
			file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'print(y)'))
		]
	},
	{
		name:   'editing only the second file while the first file stays unchanged',
		inputs: [
			file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
			file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'y <- y * 2', 'print(y)'))
		]
	},
	{
		name:   'editing both files independently in the same run',
		inputs: [
			file('a.R', lines('x <- 1', 'print(x)'), lines('x <- 2', 'x <- x * 3', 'print(x)')),
			file('b.R', lines('y <- 10', 'print(y)'), lines('z <- 10', 'print(z + 1)'))
		]
	},
	{
		name:   'adding a new file while another file stays unchanged',
		inputs: [
			file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
			file('b.R', '', lines('helper <- function(x) {', '\tx * 2', '}', 'print(helper(21))'))
		]
	},
	{
		name:   'removing one file while another file stays unchanged',
		inputs: [
			file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
			file('b.R', lines('tmp <- 1', 'print(tmp)'), '')
		]
	},
	{
		name:   'mixing file modification, file addition, and file removal in one run',
		inputs: [
			file('a.R', lines('x <- 1', 'print(x)'), lines('x <- 1', 'x <- x + 1', 'print(x)')),
			file('b.R', '', lines('y <- 21', 'print(y)')),
			file('c.R', lines('obsolete <- TRUE', 'print(obsolete)'), '')
		]
	},
	{
		name:   'making one file invalid while another file remains unchanged and valid',
		inputs: [
			file(
				'a.R',
				lines('f <- function(x) {', '\tprint(x)', '}'),
				lines('f <- function(x) {', '\tprint(x)')
			),
			file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'print(y)'))
		]
	},
	{
		name:   'editing UTF-8 content in one file while another file stays unchanged',
		inputs: [
			file('a.R', lines('msg <- "äöü"', 'print(msg)'), lines('msg <- "äöü€"', 'print(msg)')),
			file('b.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)'))
		]
	},
	{
		name:   'editing inside a nested construct in one file and at top level in another',
		inputs: [
			file(
				'a.R',
				lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'),
				lines('f <- function(x) {', '\ty <- x * 2', '\tprint(y)', '}')
			),
			file('b.R', lines('z <- 3', 'print(z)'), lines('z <- 3', 'z <- z + 1', 'print(z)'))
		]
	},
	{
		name:   'editing only one of two syntactically invalid files',
		inputs: [
			file('a.R', 'print(', 'print(1)'),
			file('b.R', 'x <-', 'x <-')
		]
	}
];

const repeatedMultiFilePairwiseCases: MultiFileCase[] = [
	{
		name:   'pairwise sequence step 1 across files',
		inputs: [
			file('a.R', '', 'x <- 1'),
			file('b.R', '', 'y <- 2')
		]
	},
	{
		name:   'pairwise sequence step 2 across files',
		inputs: [
			file('a.R', 'x <- 1', lines('x <- 1', 'print(x)')),
			file('b.R', 'y <- 2', 'y <- 20')
		]
	},
	{
		name:   'pairwise sequence step 3 across files with temporary invalidity',
		inputs: [
			file('a.R', lines('x <- 1', 'print(x)'), 'x <-'),
			file('b.R', 'y <- 20', lines('f <- function() {', '\tprint(y)', '}', 'f()'))
		]
	},
	{
		name:   'pairwise sequence step 4 across files returning to valid syntax',
		inputs: [
			file('a.R', 'x <-', lines('x <- 1', 'print(x)')),
			file('b.R', lines('f <- function() {', '\tprint(y)', '}', 'f()'), lines('f <- function() {', '\tprint(y + 1)', '}', 'f()'))
		]
	}
];


describe('Incremental Parsing produces same results as Full Parsing', () => {
	describe('single-file', () => {
		describe('no-op', () => {
			it.each(singleFileNoOpCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('insert', () => {
			it.each(singleFileInsertCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('remove', () => {
			it.each(singleFileRemoveCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('replace', () => {
			it.each(singleFileReplaceCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('syntax transitions', () => {
			it.each(singleFileSyntaxTransitionCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('nested structures', () => {
			it.each(singleFileNestedStructureCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});

		describe('pairwise successive states', () => {
			it.each(repeatedUpdatePairwiseCases)('$name', async({ input }) => {
				await executeAndCompareResults([input]);
			});
		});
	});

	describe('multi-file', () => {
		it.each(multiFileCases)('$name', async({ inputs }) => {
			await executeAndCompareResults(inputs);
		});

		describe('pairwise successive states across files', () => {
			it.each(repeatedMultiFilePairwiseCases)('$name', async({ inputs }) => {
				await executeAndCompareResults(inputs);
			});
		});
	});
});








describe('Incremental Parsing produces same results as Full Parsing for one file for', () => {
	describe('no change', () => {
		describe('to an empty file', async() => {
			const inputs: IncrementalParsingTestInput[] = [{
				originalContent: '',
				updatedContent:  '',
				path:            'a.R'
			}];
			await executeAndCompareResults(inputs);
		});
		describe('to a file with content', async() => {
			const inputs: IncrementalParsingTestInput[] = [{
				originalContent: 'x <- 42',
				updatedContent:  'x <- 42',
				path:            'a.R'
			}];
			await executeAndCompareResults(inputs);
		});
	});
	describe('one line', () => {
		describe('inserted', () => {
			describe('into an empty file', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: '',
					updatedContent:  'x <- 42',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at the start', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42',
					updatedContent:  'y <- 21\nx <- 42',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at the end', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42',
					updatedContent:  'x <- 42\nprint(x)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('in the middle', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nprint(x)',
					updatedContent:  'x <- 42\nx <- 2 * x\nprint(x)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
		describe('removed', () => {
			describe('such that the file becomes empty', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42',
					updatedContent:  '',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at the start', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'y <- 21\nx <- 42',
					updatedContent:  'x <- 42',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at the end', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nprint(x)',
					updatedContent:  'x <- 42',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('in the middle', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nx <- 2 * x\nprint(x)',
					updatedContent:  'x <- 42\nprint(x)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
		describe('replaced', () => {
			describe('at the start', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'y <- 21\nx <- 42',
					updatedContent:  'x <- 21\nx <- 42',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at the end', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nprint(x)',
					updatedContent:  'x <- 42\nx <- x * x',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('in the middle', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nx <- 2 * x\nprint(x)',
					updatedContent:  'x <- 42\nx <- 21\nprint(x)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
	});
	describe('multiple lines', () => {
		describe('inserted', () => {
			describe('into an empty file', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: '',
					updatedContent:  'x <- 42\ny <- 21\nz <- 10',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at different positions', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\nprint(x)',
					updatedContent:  'y <- 21\nx <- 42\ny <- y * 2\nprint(x)\nprint(y)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
		describe('removed', () => {
			describe('such that the file becomes empty', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'x <- 42\ny <- 21\nz <- 10',
					updatedContent:  '',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('at different positions', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'y <- 21\nx <- 42\ny <- y * 2\nprint(x)\nprint(y)',
					updatedContent:  'x <- 42\nprint(x)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
		describe('replaced', () => {
			describe('partially', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'y <- 21\nx <- 42\ny <- y * 2\nprint(x)\nprint(y)',
					updatedContent:  'y <- 21\nx <- 21\ny <- y * y\nprint(x)\nprint(y + 2)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
			describe('fully', async() => {
				const inputs: IncrementalParsingTestInput[] = [{
					originalContent: 'y <- 21\nx <- 42\ny <- y * 2\nprint(x)\nprint(y)',
					updatedContent:  'z <- 10\nz <- z + 32\nprint(z)',
					path:            'a.R'
				}];
				await executeAndCompareResults(inputs);
			});
		});
	});
});


describe('Incremental Parsing produces same results as Full Parsing across multiple files for', () => {
	it('editing only the first file while the second file stays unchanged', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 42\nprint(x)',
				updatedContent:  'x <- 42\nx <- x + 1\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: 'y <- 21\nprint(y)',
				updatedContent:  'y <- 21\nprint(y)',
				path:            'b.R'
			}
		];
		await executeAndCompareResults(inputs);
	});

	it('editing only the second file while the first file stays unchanged', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 42\nprint(x)',
				updatedContent:  'x <- 42\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: 'y <- 21\nprint(y)',
				updatedContent:  'y <- 21\ny <- y * 2\nprint(y)',
				path:            'b.R'
			}
		];
		await executeAndCompareResults(inputs);
	});

	it('editing both files independently in the same run', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 1\nprint(x)',
				updatedContent:  'x <- 2\nx <- x * 3\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: 'y <- 10\nprint(y)',
				updatedContent:  'z <- 10\nprint(z + 1)',
				path:            'b.R'
			}
		];
		await executeAndCompareResults(inputs);
	});

	it('adding a new file while another file stays unchanged', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 42\nprint(x)',
				updatedContent:  'x <- 42\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: '',
				updatedContent:  'foo <- function(x) x * 2\nprint(foo(21))',
				path:            'b.R'
			}
		];
		await executeAndCompareResults(inputs);
	});

	it('removing one file while another file stays unchanged', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 42\nprint(x)',
				updatedContent:  'x <- 42\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: 'tmp <- 1\nprint(tmp)',
				updatedContent:  '',
				path:            'b.R'
			}
		];
		await executeAndCompareResults(inputs);
	});

	it('mixing file modification, file addition, and file removal in one run', async() => {
		const inputs: IncrementalParsingTestInput[] = [
			{
				originalContent: 'x <- 1\nprint(x)',
				updatedContent:  'x <- 1\nx <- x + 1\nprint(x)',
				path:            'a.R'
			},
			{
				originalContent: '',
				updatedContent:  'y <- 21\nprint(y)',
				path:            'b.R'
			},
			{
				originalContent: 'obsolete <- TRUE\nprint(obsolete)',
				updatedContent:  '',
				path:            'c.R'
			}
		];
		await executeAndCompareResults(inputs);
	});
});