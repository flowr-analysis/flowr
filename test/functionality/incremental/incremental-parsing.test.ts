import { assert, describe, expect, it, vi } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { printNormalizedAstToMermaid } from '../../../src/core/print/normalize-printer';
import type { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import type { Tree } from 'web-tree-sitter';
import type { ParseStepOutput, ParseStepOutputSingleFile } from '../../../src/r-bridge/parser';


interface IncrementalParsingTestInput {
	path:            string;
	originalContent: string;
	updatedContent:  string;
}

interface IncrementalParseCall {
	filePath:     string;
	previousTree: Tree | undefined;
}

async function traceIncrementalParseCalls<T>(
	analyzer: FlowrAnalyzer,
	run: () => Promise<T>
): Promise<{ result: T; incrementalParseCalls: IncrementalParseCall[] }> {
	const executor = analyzer['parser'] as TreeSitterExecutor;
	const parser = executor['parser'];
	const originalExecutorParse = executor.parse.bind(executor);
	const originalParserParse = parser.parse.bind(parser);
	let currentFilePath: string | undefined;
	const incrementalParseCalls: IncrementalParseCall[] = [];

	// The outer executor still knows which file is being parsed, so we capture that path for the nested Tree-sitter call.
	const executorSpy = vi.spyOn(executor, 'parse').mockImplementation((request, ctx) => {
		currentFilePath = request.filePath;
		try {
			return originalExecutorParse(request, ctx);
		} finally {
			currentFilePath = undefined;
		}
	});

	// The inner Tree-sitter parser sees the reused previous tree but not the file path, so we pair it with the path captured above.
	const parserSpy = vi.spyOn(parser, 'parse').mockImplementation((sourceCode, previousTree) => {
		assert(currentFilePath !== undefined, 'inner Tree-sitter parse should only be called while handling a file-backed parse request');
		incrementalParseCalls.push({
			filePath:     currentFilePath,
			previousTree: previousTree
		});
		return originalParserParse(sourceCode, previousTree);
	});

	try {
		return {
			result: await run(),
			incrementalParseCalls
		};
	} finally {
		executorSpy.mockRestore();
		parserSpy.mockRestore();
	}
}

function capturePreviousTrees(analyzer: FlowrAnalyzer): Map<string, Tree> {
	const initialParse = analyzer.peekParse();
	assert(initialParse !== undefined);

	const previousTrees = new Map<string, Tree>();
	for(const parsedFile of initialParse.files) {
		assert(parsedFile.filePath !== undefined);
		previousTrees.set(parsedFile.filePath, parsedFile.parsed as Tree);
	}
	return previousTrees;
}

function assertChangedFilesUseIncrementalParse(
	inputs: readonly IncrementalParsingTestInput[],
	previousTrees: ReadonlyMap<string, Tree>,
	incrementalParseCalls: readonly IncrementalParseCall[]
): void {
	const changedInputs = inputs.filter(input => input.updatedContent !== input.originalContent);
	expect(incrementalParseCalls).toHaveLength(changedInputs.length);

	for(const changedInput of changedInputs) {
		const previousTree = previousTrees.get(changedInput.path);
		assert(previousTree !== undefined, `Missing previous tree for ${changedInput.path}`);

		const parseCall = incrementalParseCalls.find(call => call.filePath === changedInput.path);
		assert(parseCall !== undefined, `Missing incremental parse call for ${changedInput.path}`);
		expect(parseCall.previousTree).toBe(previousTree);
	}
}

function assertUnchangedFilesReusePreviousTrees(
	inputs: readonly IncrementalParsingTestInput[],
	previousTrees: ReadonlyMap<string, Tree>,
	reparsedTrees: ParseStepOutputSingleFile<Tree>[]
): void {
	for(const input of inputs) {
		if(input.updatedContent !== input.originalContent) {
			continue;
		}

		const previousTree = previousTrees.get(input.path);
		const reparsedTree = reparsedTrees.find(file => file.filePath === input.path)?.parsed;
		assert(previousTree !== undefined, `Missing previous tree for ${input.path}`);
		assert(reparsedTree !== undefined, `Missing reparsed tree for ${input.path}`);
		expect(reparsedTree, `no-op invalidation should reuse the previous tree for ${input.path}`).toBe(previousTree);
	}
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

	const previousTrees = capturePreviousTrees(analyzer);
	for(const input of inputs) {
		files.get(input.path)?.updateInlineContent(input.updatedContent);
	}
	assert(analyzer.peekParse() === undefined, 'changing the content of parsed files should reset the previous pipeline');

	const { result, incrementalParseCalls } = await traceIncrementalParseCalls(
		analyzer,
		async() => await analyzer.normalize()
	);
	const reparsed = analyzer.peekParse() as ParseStepOutput<Tree>;
	assert(reparsed !== undefined, 'after parsing once more, the pipeline must contain the analysis results again');

	assertChangedFilesUseIncrementalParse(inputs, previousTrees, incrementalParseCalls);
	assertUnchangedFilesReusePreviousTrees(inputs, previousTrees, reparsed.files);

	return result;
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


describe('Incremental Parsing produces same results as Full Parsing', () => {
	describe('single-file', () => {
		describe('no-op', () => {
			it('empty file', async() => {
				await executeAndCompareResults([file('a.R', '', '')]);
			});

			it('file with top-level content', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x <- 42')]);
			});

			it('file with nested content', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});

			it('syntactically invalid file', async() => {
				await executeAndCompareResults([file('a.R', 'print(', 'print(')]);
			});
		});

		describe('insert', () => {
			it('one full line into an empty file', async() => {
				await executeAndCompareResults([file('a.R', '', 'x <- 42')]);
			});

			it('one full line at the start of a file', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', lines('y <- 21', 'x <- 42'))]);
			});

			it('one full line in the middle of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'x <- 2 * x', 'print(x)'))]);
			});

			it('one full line at the end of a file', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', lines('x <- 42', 'print(x)'))]);
			});

			it('multiple lines into an empty file', async() => {
				await executeAndCompareResults([file('a.R', '', lines('x <- 42', 'y <- 21', 'z <- 10'))]);
			});

			it('multiple lines at different positions', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'print(x)'), lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'))]);
			});

			it('a single character inside a number', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x <- 420')]);
			});

			it('a single character inside an identifier', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'xy <- 42')]);
			});

			it('a token inside an expression', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 1 + 2', 'x <- 1 + 2 + 3')]);
			});

			it('a token inside a nested argument list', async() => {
				await executeAndCompareResults([file('a.R', 'print(sum(1, 3))', 'print(sum(1, 2, 3))')]);
			});

			it('a trailing newline at end of file', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x <- 42\n')]);
			});
		});

		describe('remove', () => {
			it('one full line such that the file becomes empty', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', '')]);
			});

			it('one full line at the start of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('y <- 21', 'x <- 42'), 'x <- 42')]);
			});

			it('one full line in the middle of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'x <- 2 * x', 'print(x)'), lines('x <- 42', 'print(x)'))]);
			});

			it('one full line at the end of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'print(x)'), 'x <- 42')]);
			});

			it('multiple lines such that the file becomes empty', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'y <- 21', 'z <- 10'), '')]);
			});

			it('multiple lines at different positions', async() => {
				await executeAndCompareResults([file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'), lines('x <- 42', 'print(x)'))]);
			});

			it('a single character from a number', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 420', 'x <- 42')]);
			});

			it('a single character from an identifier', async() => {
				await executeAndCompareResults([file('a.R', 'xy <- 42', 'x <- 42')]);
			});

			it('a token from an expression', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 1 + 2 + 3', 'x <- 1 + 2')]);
			});

			it('a token from a nested argument list', async() => {
				await executeAndCompareResults([file('a.R', 'print(sum(1, 2, 3))', 'print(sum(1, 3))')]);
			});

			it('a trailing newline at end of file', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42\n', 'x <- 42')]);
			});
		});

		describe('replace', () => {
			it('one full line at the start of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('y <- 21', 'x <- 42'), lines('x <- 84', 'x <- 42'))]);
			});

			it('one full line in the middle of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'x <- 2 * x', 'print(x)'), lines('x <- 42', 'y <- 21', 'print(x)'))]);
			});

			it('one full line at the end of a file', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'x <- x * x'))]);
			});

			it('a partially replaced multi-line region', async() => {
				await executeAndCompareResults([file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'), lines('y <- 21', 'x <- 21', 'y <- y * y', 'print(x)', 'print(y)'))]);
			});

			it('a fully replaced content', async() => {
				await executeAndCompareResults([file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'), lines('z <- 10', 'z <- z + 32', 'print(z)'))]);
			});

			it('a single character in a number', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x <- 43')]);
			});

			it('an operator token', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 1 + 2', 'x <- 1 * 2')]);
			});

			it('an identifier token', async() => {
				await executeAndCompareResults([file('a.R', lines('x <- 42', 'print(x)'), lines('value <- 42', 'print(value)'))]);
			});

			it('part of a single line expression', async() => {
				await executeAndCompareResults([file('a.R', 'x <- (1 + 2) * 3', 'x <- (1 + 20) * 3')]);
			});

			it('whitespace only on a single line', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x    <-    42')]);
			});

			it('whitespace only across multiple lines', async() => {
				await executeAndCompareResults([file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'), lines('f <- function(x) {', '\t', '\ty <- x + 1', '\tprint(y)', '}'))]);
			});

			it('comment text', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42 # old comment', 'x <- 42 # new comment')]);
			});

			it('a string literal', async() => {
				await executeAndCompareResults([file('a.R', 'msg <- "abc"', 'msg <- "abcd"')]);
			});

			it('a UTF-8 string literal', async() => {
				await executeAndCompareResults([file('a.R', 'msg <- "Ã¤Ã¶Ã¼"', 'msg <- "Ã¤Ã¶Ã¼â‚¬"')]);
			});

			it('a UTF-8 comment', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42 # gruÃŸ', 'x <- 42 # grÃ¼ÃŸe â‚¬')]);
			});
		});

		describe('syntax transitions', () => {
			it('valid to invalid by removing the right-hand side of an assignment', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 42', 'x <-')]);
			});

			it('valid to invalid by removing a closing brace', async() => {
				await executeAndCompareResults([file(
					'a.R',
					lines(
						'f <- function(x) {',
						'\tprint(x)',
						'}'
					),
					lines(
						'f <- function(x) {',
						'\tprint(x)'
					)
				)]);
			});

			it('valid to invalid by removing a closing parenthesis', async() => {
				await executeAndCompareResults([file('a.R', 'print(sum(1, 2))', 'print(sum(1, 2)')]);
			});

			it('invalid to valid by completing an assignment', async() => {
				await executeAndCompareResults([file('a.R', 'x <-', 'x <- 42')]);
			});

			it('invalid to valid by restoring a closing brace', async() => {
				await executeAndCompareResults([file(
					'a.R',
					lines(
						'f <- function(x) {',
						'\tprint(x)'
					),
					lines(
						'f <- function(x) {',
						'\tprint(x)',
						'}'
					)
				)]);
			});

			it('invalid to valid by restoring a closing parenthesis', async() => {
				await executeAndCompareResults([file('a.R', 'print(sum(1, 2)', 'print(sum(1, 2))')]);
			});

			it('invalid to invalid across different incomplete forms', async() => {
				await executeAndCompareResults([file('a.R', 'print(', 'function(,')]);
			});
		});

		describe('nested structures', () => {
			it('inside a function body', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});

			it('inside an if branch', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});

			it('inside a for loop body', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});

			it('inside a nested argument list', async() => {
				await executeAndCompareResults([file('a.R', 'print(sum(1, 2, 3))', 'print(sum(1, 20, 3))')]);
			});

			it('inside nested brackets and subexpressions', async() => {
				await executeAndCompareResults([file('a.R', 'x <- list(a = list(b = 1))', 'x <- list(a = list(b = 2))')]);
			});
		});

		describe('pairwise successive states', () => {
			it('sequence step 1: empty file to initial assignment', async() => {
				await executeAndCompareResults([file('a.R', '', 'x <- 1')]);
			});

			it('sequence step 2: initial assignment to character-level update', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 1', 'x <- 10')]);
			});

			it('sequence step 3: character-level update to added statement', async() => {
				await executeAndCompareResults([file('a.R', 'x <- 10', lines('x <- 10', 'print(x)'))]);
			});

			it('sequence step 4: added statement to nested function', async() => {
				await executeAndCompareResults([file(
					'a.R',
					lines('x <- 10', 'print(x)'),
					lines(
						'f <- function() {',
						'\tprint(x)',
						'}',
						'f()'
					)
				)]);
			});

			it('sequence step 5: nested function to temporarily invalid syntax', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});

			it('sequence step 6: temporarily invalid syntax back to valid syntax', async() => {
				await executeAndCompareResults([file(
					'a.R',
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
				)]);
			});
		});
	});

	describe('multi-file', () => {
		it('editing only the first file while the second file stays unchanged', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'x <- x + 1', 'print(x)')),
				file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'print(y)'))
			]);
		});

		it('editing only the second file while the first file stays unchanged', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
				file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'y <- y * 2', 'print(y)'))
			]);
		});

		it('editing both files independently in the same run', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 1', 'print(x)'), lines('x <- 2', 'x <- x * 3', 'print(x)')),
				file('b.R', lines('y <- 10', 'print(y)'), lines('z <- 10', 'print(z + 1)'))
			]);
		});

		it('adding a new file while another file stays unchanged', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
				file('b.R', '', lines('helper <- function(x) {', '\tx * 2', '}', 'print(helper(21))'))
			]);
		});

		it('removing one file while another file stays unchanged', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)')),
				file('b.R', lines('tmp <- 1', 'print(tmp)'), '')
			]);
		});

		it('mixing file modification, file addition, and file removal in one run', async() => {
			await executeAndCompareResults([
				file('a.R', lines('x <- 1', 'print(x)'), lines('x <- 1', 'x <- x + 1', 'print(x)')),
				file('b.R', '', lines('y <- 21', 'print(y)')),
				file('c.R', lines('obsolete <- TRUE', 'print(obsolete)'), '')
			]);
		});

		it('making one file invalid while another file remains unchanged and valid', async() => {
			await executeAndCompareResults([
				file(
					'a.R',
					lines('f <- function(x) {', '\tprint(x)', '}'),
					lines('f <- function(x) {', '\tprint(x)')
				),
				file('b.R', lines('y <- 21', 'print(y)'), lines('y <- 21', 'print(y)'))
			]);
		});

		it('editing UTF-8 content in one file while another file stays unchanged', async() => {
			await executeAndCompareResults([
				file('a.R', lines('msg <- "Ã¤Ã¶Ã¼"', 'print(msg)'), lines('msg <- "Ã¤Ã¶Ã¼â‚¬"', 'print(msg)')),
				file('b.R', lines('x <- 42', 'print(x)'), lines('x <- 42', 'print(x)'))
			]);
		});

		it('editing inside a nested construct in one file and at top level in another', async() => {
			await executeAndCompareResults([
				file(
					'a.R',
					lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'),
					lines('f <- function(x) {', '\ty <- x * 2', '\tprint(y)', '}')
				),
				file('b.R', lines('z <- 3', 'print(z)'), lines('z <- 3', 'z <- z + 1', 'print(z)'))
			]);
		});

		it('editing only one of two syntactically invalid files', async() => {
			await executeAndCompareResults([
				file('a.R', 'print(', 'print(1)'),
				file('b.R', 'x <-', 'x <-')
			]);
		});

		describe('pairwise successive states across files', () => {
			it('pairwise sequence step 1 across files', async() => {
				await executeAndCompareResults([
					file('a.R', '', 'x <- 1'),
					file('b.R', '', 'y <- 2')
				]);
			});

			it('pairwise sequence step 2 across files', async() => {
				await executeAndCompareResults([
					file('a.R', 'x <- 1', lines('x <- 1', 'print(x)')),
					file('b.R', 'y <- 2', 'y <- 20')
				]);
			});

			it('pairwise sequence step 3 across files with temporary invalidity', async() => {
				await executeAndCompareResults([
					file('a.R', lines('x <- 1', 'print(x)'), 'x <-'),
					file('b.R', 'y <- 20', lines('f <- function() {', '\tprint(y)', '}', 'f()'))
				]);
			});

			it('pairwise sequence step 4 across files returning to valid syntax', async() => {
				await executeAndCompareResults([
					file('a.R', 'x <-', lines('x <- 1', 'print(x)')),
					file('b.R', lines('f <- function() {', '\tprint(y)', '}', 'f()'), lines('f <- function() {', '\tprint(y + 1)', '}', 'f()'))
				]);
			});
		});
	});
});
