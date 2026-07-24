import { assert, describe, expect, it, vi } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { printNormalizedAstToMermaid } from '../../../src/core/print/normalize-printer';
import type { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import type { Tree } from 'web-tree-sitter';
import type { ParseStepOutput, ParseStepOutputSingleFile } from '../../../src/r-bridge/parser';


interface FileState {
	path:    string;
	content: string;
}

interface IncrementalParsingScenario {
	testLabel:    string;
	initialFiles: readonly FileState[];
	fileUpdates:  readonly (readonly FileState[])[];
}

interface IncrementalParseCall {
	filePath:     string;
	previousTree: Tree | undefined;
}

function applyUpdateStepToFileStates(
	fileStates: Map<string, string>,
	updateStep: readonly FileState[]
): void {
	for(const update of updateStep) {
		assert(fileStates.has(update.path), `All paths must be present in initialFiles, missing ${update.path}`);
		fileStates.set(update.path, update.content);
	}
}

function changedPathsBetween(
	beforeStep: ReadonlyMap<string, string>,
	afterStep: ReadonlyMap<string, string>
): string[] {
	return Array.from(beforeStep.keys()).filter(path => beforeStep.get(path) !== afterStep.get(path));
}

function unchangedPathsBetween(
	beforeStep: ReadonlyMap<string, string>,
	afterStep: ReadonlyMap<string, string>
): string[] {
	return Array.from(beforeStep.keys()).filter(path => beforeStep.get(path) === afterStep.get(path));
}

async function createAnalyzerForFiles(
	initialFiles: readonly FileState[]
): Promise<{ analyzer: FlowrAnalyzer; files: Map<string, FlowrInlineTextFile> }> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	const files = new Map<string, FlowrInlineTextFile>();

	for(const initialFile of initialFiles) {
		const file = new FlowrInlineTextFile(initialFile.path, initialFile.content);
		analyzer.addFile(file);
		analyzer.addRequest({ request: 'file', content: initialFile.path });
		files.set(initialFile.path, file);
	}

	return { analyzer, files };
}

function applyUpdateStepToAnalyzer(
	files: ReadonlyMap<string, FlowrInlineTextFile>,
	updateStep: readonly FileState[]
): void {
	for(const update of updateStep) {
		const file = files.get(update.path);
		assert(file !== undefined, `All paths must be present in initialFiles, missing ${update.path}`);
		file.updateInlineContent(update.content);
	}
}

function createIncrementalParseTracer(analyzer: FlowrAnalyzer): {
	trace<T>(run: () => Promise<T>): Promise<{ result: T; incrementalParseCalls: IncrementalParseCall[] }>;
	restore(): void;
} {
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

	return {
		async trace<T>(run: () => Promise<T>): Promise<{ result: T; incrementalParseCalls: IncrementalParseCall[] }> {
			incrementalParseCalls.length = 0;
			return {
				result:                await run(),
				incrementalParseCalls: [...incrementalParseCalls]
			};
		},
		restore(): void {
			executorSpy.mockRestore();
			parserSpy.mockRestore();
		}
	};
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
	changedPaths: readonly string[],
	previousTrees: ReadonlyMap<string, Tree>,
	incrementalParseCalls: readonly IncrementalParseCall[]
): void {
	expect(incrementalParseCalls).toHaveLength(changedPaths.length);

	for(const changedPath of changedPaths) {
		const previousTree = previousTrees.get(changedPath);
		assert(previousTree !== undefined, `Missing previous tree for ${changedPath}`);

		const parseCall = incrementalParseCalls.find(call => call.filePath === changedPath);
		assert(parseCall !== undefined, `Missing incremental parse call for ${changedPath}`);
		expect(parseCall.previousTree).toBe(previousTree);
	}
}

function assertUnchangedFilesReusePreviousTrees(
	unchangedPaths: readonly string[],
	previousTrees: ReadonlyMap<string, Tree>,
	reparsedTrees: ParseStepOutputSingleFile<Tree>[]
): void {
	for(const unchangedPath of unchangedPaths) {
		const previousTree = previousTrees.get(unchangedPath);
		const reparsedTree = reparsedTrees.find(file => file.filePath === unchangedPath)?.parsed;
		assert(previousTree !== undefined, `Missing previous tree for ${unchangedPath}`);
		assert(reparsedTree !== undefined, `Missing reparsed tree for ${unchangedPath}`);
		expect(reparsedTree, `no-op invalidation should reuse the previous tree for ${unchangedPath}`).toBe(previousTree);
	}
}

function assertPipelineStateAfterUpdateStep(
	analyzer: FlowrAnalyzer,
	updateStep: readonly FileState[]
): void {
	if(updateStep.length === 0) {
		assert(analyzer.peekParse() !== undefined, 'without any file updates, the previous pipeline should remain available');
		return;
	}

	assert(analyzer.peekParse() === undefined, 'changing the content of parsed files should reset the previous pipeline');
}

async function executeFullParse(fileStates: readonly FileState[]): Promise<NormalizedAst> {
	const { analyzer } = await createAnalyzerForFiles(fileStates);
	return await analyzer.normalize();
}

function executeAndCompareScenario(scenario: IncrementalParsingScenario): void {
	it(scenario.testLabel, async() => {
		const { analyzer, files } = await createAnalyzerForFiles(scenario.initialFiles);
		const incrementalParseTracer = createIncrementalParseTracer(analyzer);
		await analyzer.normalize();
		const currentFileStates: Map<string, string> = new Map(scenario.initialFiles.map(fileState => [fileState.path, fileState.content]));

		try {
			for(const updateStep of scenario.fileUpdates) {
				const previousTrees = capturePreviousTrees(analyzer);
				const previousFileStates = new Map(currentFileStates);

				applyUpdateStepToAnalyzer(files, updateStep);
				applyUpdateStepToFileStates(currentFileStates, updateStep);
				assertPipelineStateAfterUpdateStep(analyzer, updateStep);

				const changedPaths = changedPathsBetween(previousFileStates, currentFileStates);
				const unchangedPaths = unchangedPathsBetween(previousFileStates, currentFileStates);
				const { result: incrementalResult, incrementalParseCalls } = await incrementalParseTracer.trace(
					async() => await analyzer.normalize()
				);
				const reparsed = analyzer.peekParse() as ParseStepOutput<Tree>;
				assert(reparsed !== undefined, 'after parsing once more, the pipeline must contain the analysis results again');

				assertChangedFilesUseIncrementalParse(changedPaths, previousTrees, incrementalParseCalls);
				assertUnchangedFilesReusePreviousTrees(unchangedPaths, previousTrees, reparsed.files);

				const fileStatesFromMap = Array.from(currentFileStates, ([path, content]) => ({ path, content }));
				const fullReparseResult = await executeFullParse(fileStatesFromMap);
				assert.equal(
					printNormalizedAstToMermaid(fullReparseResult),
					printNormalizedAstToMermaid(incrementalResult),
					'The incremental parse result does not match the full parse result'
				);
			}
		} finally {
			incrementalParseTracer.restore();
		}
	});
}

const lines = (...xs: string[]): string => xs.join('\n');

const file = (
	path: string,
	content: string
): FileState => ({
	path,
	content
});

const step = (...files: FileState[]): readonly FileState[] => files;

const scenario = (
	testLabel: string,
	initialFiles: readonly FileState[],
	...fileUpdates: readonly (readonly FileState[])[]
): IncrementalParsingScenario => ({
	testLabel,
	initialFiles,
	fileUpdates
});


describe('Incremental Parsing produces same results as Full Parsing', () => {
	describe('one update set', () => {
		describe('single-file', () => {
			describe('no-op', () => {
				executeAndCompareScenario(scenario(
					'empty file',
					[file('a.R', '')],
					step(file('a.R', ''))
				));

				executeAndCompareScenario(scenario(
					'file with top-level content',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'file with nested content',
					[file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'))],
					step(file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}')))
				));

				executeAndCompareScenario(scenario(
					'syntactically invalid file',
					[file('a.R', 'print(')],
					step(file('a.R', 'print('))
				));
			});

			describe('insert', () => {
				executeAndCompareScenario(scenario(
					'one full line into an empty file',
					[file('a.R', '')],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'one full line at the start of a file',
					[file('a.R', 'x <- 42')],
					step(file('a.R', lines('y <- 21', 'x <- 42')))
				));

				executeAndCompareScenario(scenario(
					'one full line in the middle of a file',
					[file('a.R', lines('x <- 42', 'print(x)'))],
					step(file('a.R', lines('x <- 42', 'x <- 2 * x', 'print(x)')))
				));

				executeAndCompareScenario(scenario(
					'one full line at the end of a file',
					[file('a.R', 'x <- 42')],
					step(file('a.R', lines('x <- 42', 'print(x)')))
				));

				executeAndCompareScenario(scenario(
					'multiple lines into an empty file',
					[file('a.R', '')],
					step(file('a.R', lines('x <- 42', 'y <- 21', 'z <- 10')))
				));

				executeAndCompareScenario(scenario(
					'multiple lines at different positions',
					[file('a.R', lines('x <- 42', 'print(x)'))],
					step(file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)')))
				));

				executeAndCompareScenario(scenario(
					'a single character inside a number',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x <- 420'))
				));

				executeAndCompareScenario(scenario(
					'a single character inside an identifier',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'xy <- 42'))
				));

				executeAndCompareScenario(scenario(
					'a token inside an expression',
					[file('a.R', 'x <- 1 + 2')],
					step(file('a.R', 'x <- 1 + 2 + 3'))
				));

				executeAndCompareScenario(scenario(
					'a token inside a nested argument list',
					[file('a.R', 'print(sum(1, 3))')],
					step(file('a.R', 'print(sum(1, 2, 3))'))
				));

				executeAndCompareScenario(scenario(
					'a trailing newline at end of file',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x <- 42\n'))
				));
			});

			describe('remove', () => {
				executeAndCompareScenario(scenario(
					'one full line such that the file becomes empty',
					[file('a.R', 'x <- 42')],
					step(file('a.R', ''))
				));

				executeAndCompareScenario(scenario(
					'one full line at the start of a file',
					[file('a.R', lines('y <- 21', 'x <- 42'))],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'one full line in the middle of a file',
					[file('a.R', lines('x <- 42', 'x <- 2 * x', 'print(x)'))],
					step(file('a.R', lines('x <- 42', 'print(x)')))
				));

				executeAndCompareScenario(scenario(
					'one full line at the end of a file',
					[file('a.R', lines('x <- 42', 'print(x)'))],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'multiple lines such that the file becomes empty',
					[file('a.R', lines('x <- 42', 'y <- 21', 'z <- 10'))],
					step(file('a.R', ''))
				));

				executeAndCompareScenario(scenario(
					'multiple lines at different positions',
					[file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'))],
					step(file('a.R', lines('x <- 42', 'print(x)')))
				));

				executeAndCompareScenario(scenario(
					'a single character from a number',
					[file('a.R', 'x <- 420')],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'a single character from an identifier',
					[file('a.R', 'xy <- 42')],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'a token from an expression',
					[file('a.R', 'x <- 1 + 2 + 3')],
					step(file('a.R', 'x <- 1 + 2'))
				));

				executeAndCompareScenario(scenario(
					'a token from a nested argument list',
					[file('a.R', 'print(sum(1, 2, 3))')],
					step(file('a.R', 'print(sum(1, 3))'))
				));

				executeAndCompareScenario(scenario(
					'a trailing newline at end of file',
					[file('a.R', 'x <- 42\n')],
					step(file('a.R', 'x <- 42'))
				));
			});

			describe('replace', () => {
				executeAndCompareScenario(scenario(
					'one full line at the start of a file',
					[file('a.R', lines('y <- 21', 'x <- 42'))],
					step(file('a.R', lines('x <- 84', 'x <- 42')))
				));

				executeAndCompareScenario(scenario(
					'one full line in the middle of a file',
					[file('a.R', lines('x <- 42', 'x <- 2 * x', 'print(x)'))],
					step(file('a.R', lines('x <- 42', 'y <- 21', 'print(x)')))
				));

				executeAndCompareScenario(scenario(
					'one full line at the end of a file',
					[file('a.R', lines('x <- 42', 'print(x)'))],
					step(file('a.R', lines('x <- 42', 'x <- x * x')))
				));

				executeAndCompareScenario(scenario(
					'a partially replaced multi-line region',
					[file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'))],
					step(file('a.R', lines('y <- 21', 'x <- 21', 'y <- y * y', 'print(x)', 'print(y)')))
				));

				executeAndCompareScenario(scenario(
					'a fully replaced content',
					[file('a.R', lines('y <- 21', 'x <- 42', 'y <- y * 2', 'print(x)', 'print(y)'))],
					step(file('a.R', lines('z <- 10', 'z <- z + 32', 'print(z)')))
				));

				executeAndCompareScenario(scenario(
					'a single character in a number',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x <- 43'))
				));

				executeAndCompareScenario(scenario(
					'an operator token',
					[file('a.R', 'x <- 1 + 2')],
					step(file('a.R', 'x <- 1 * 2'))
				));

				executeAndCompareScenario(scenario(
					'an identifier token',
					[file('a.R', lines('x <- 42', 'print(x)'))],
					step(file('a.R', lines('value <- 42', 'print(value)')))
				));

				executeAndCompareScenario(scenario(
					'part of a single line expression',
					[file('a.R', 'x <- (1 + 2) * 3')],
					step(file('a.R', 'x <- (1 + 20) * 3'))
				));

				executeAndCompareScenario(scenario(
					'whitespace only on a single line',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x    <-    42'))
				));

				executeAndCompareScenario(scenario(
					'whitespace only across multiple lines',
					[file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'))],
					step(file('a.R', lines('f <- function(x) {', '\t', '\ty <- x + 1', '\tprint(y)', '}')))
				));

				executeAndCompareScenario(scenario(
					'comment text',
					[file('a.R', 'x <- 42 # old comment')],
					step(file('a.R', 'x <- 42 # new comment'))
				));

				executeAndCompareScenario(scenario(
					'a string literal',
					[file('a.R', 'msg <- "abc"')],
					step(file('a.R', 'msg <- "abcd"'))
				));

				executeAndCompareScenario(scenario(
					'a UTF-8 string literal',
					[file('a.R', 'msg <- "ÃƒÂ¤ÃƒÂ¶ÃƒÂ¼"')],
					step(file('a.R', 'msg <- "ÃƒÂ¤ÃƒÂ¶ÃƒÂ¼Ã¢â€šÂ¬"'))
				));

				executeAndCompareScenario(scenario(
					'a UTF-8 comment',
					[file('a.R', 'x <- 42 # gruÃƒÅ¸')],
					step(file('a.R', 'x <- 42 # grÃƒÂ¼ÃƒÅ¸e Ã¢â€šÂ¬'))
				));
			});

			describe('syntax transitions', () => {
				executeAndCompareScenario(scenario(
					'valid to invalid by removing the right-hand side of an assignment',
					[file('a.R', 'x <- 42')],
					step(file('a.R', 'x <-'))
				));

				executeAndCompareScenario(scenario(
					'valid to invalid by removing a closing brace',
					[file('a.R', lines('f <- function(x) {', '\tprint(x)', '}'))],
					step(file('a.R', lines('f <- function(x) {', '\tprint(x)')))
				));

				executeAndCompareScenario(scenario(
					'valid to invalid by removing a closing parenthesis',
					[file('a.R', 'print(sum(1, 2))')],
					step(file('a.R', 'print(sum(1, 2)'))
				));

				executeAndCompareScenario(scenario(
					'invalid to valid by completing an assignment',
					[file('a.R', 'x <-')],
					step(file('a.R', 'x <- 42'))
				));

				executeAndCompareScenario(scenario(
					'invalid to valid by restoring a closing brace',
					[file('a.R', lines('f <- function(x) {', '\tprint(x)'))],
					step(file('a.R', lines('f <- function(x) {', '\tprint(x)', '}')))
				));

				executeAndCompareScenario(scenario(
					'invalid to valid by restoring a closing parenthesis',
					[file('a.R', 'print(sum(1, 2)')],
					step(file('a.R', 'print(sum(1, 2))'))
				));

				executeAndCompareScenario(scenario(
					'invalid to invalid across different incomplete forms',
					[file('a.R', 'print(')],
					step(file('a.R', 'function(,'))
				));
			});

			describe('nested structures', () => {
				executeAndCompareScenario(scenario(
					'inside a function body',
					[file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}'))],
					step(file('a.R', lines('f <- function(x) {', '\ty <- x * 2', '\tprint(y)', '}')))
				));

				executeAndCompareScenario(scenario(
					'inside an if branch',
					[file('a.R', lines('if (x > 0) {', '\ty <- 1', '}'))],
					step(file('a.R', lines('if (x > 0) {', '\ty <- 1', '\tz <- 2', '}')))
				));

				executeAndCompareScenario(scenario(
					'inside a for loop body',
					[file('a.R', lines('for (i in 1:3) {', '\tprint(i)', '}'))],
					step(file('a.R', lines('for (i in 1:3) {', '\ttotal <- i + 1', '\tprint(total)', '}')))
				));

				executeAndCompareScenario(scenario(
					'inside a nested argument list',
					[file('a.R', 'print(sum(1, 2, 3))')],
					step(file('a.R', 'print(sum(1, 20, 3))'))
				));

				executeAndCompareScenario(scenario(
					'inside nested brackets and subexpressions',
					[file('a.R', 'x <- list(a = list(b = 1))')],
					step(file('a.R', 'x <- list(a = list(b = 2))'))
				));
			});

		});

		describe('multi-file', () => {
			executeAndCompareScenario(scenario(
				'editing only the first file while the second file stays unchanged',
				[
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', lines('y <- 21', 'print(y)'))
				],
				step(
					file('a.R', lines('x <- 42', 'x <- x + 1', 'print(x)')),
					file('b.R', lines('y <- 21', 'print(y)'))
				)
			));

			executeAndCompareScenario(scenario(
				'editing only the second file while the first file stays unchanged',
				[
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', lines('y <- 21', 'print(y)'))
				],
				step(
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', lines('y <- 21', 'y <- y * 2', 'print(y)'))
				)
			));

			executeAndCompareScenario(scenario(
				'editing both files independently in the same run',
				[
					file('a.R', lines('x <- 1', 'print(x)')),
					file('b.R', lines('y <- 10', 'print(y)'))
				],
				step(
					file('a.R', lines('x <- 2', 'x <- x * 3', 'print(x)')),
					file('b.R', lines('z <- 10', 'print(z + 1)'))
				)
			));

			executeAndCompareScenario(scenario(
				'adding a new file while another file stays unchanged',
				[
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', '')
				],
				step(
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', lines('helper <- function(x) {', '\tx * 2', '}', 'print(helper(21))'))
				)
			));

			executeAndCompareScenario(scenario(
				'removing one file while another file stays unchanged',
				[
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', lines('tmp <- 1', 'print(tmp)'))
				],
				step(
					file('a.R', lines('x <- 42', 'print(x)')),
					file('b.R', '')
				)
			));

			executeAndCompareScenario(scenario(
				'mixing file modification, file addition, and file removal in one run',
				[
					file('a.R', lines('x <- 1', 'print(x)')),
					file('b.R', ''),
					file('c.R', lines('obsolete <- TRUE', 'print(obsolete)'))
				],
				step(
					file('a.R', lines('x <- 1', 'x <- x + 1', 'print(x)')),
					file('b.R', lines('y <- 21', 'print(y)')),
					file('c.R', '')
				)
			));

			executeAndCompareScenario(scenario(
				'making one file invalid while another file remains unchanged and valid',
				[
					file('a.R', lines('f <- function(x) {', '\tprint(x)', '}')),
					file('b.R', lines('y <- 21', 'print(y)'))
				],
				step(
					file('a.R', lines('f <- function(x) {', '\tprint(x)')),
					file('b.R', lines('y <- 21', 'print(y)'))
				)
			));

			executeAndCompareScenario(scenario(
				'editing UTF-8 content in one file while another file stays unchanged',
				[
					file('a.R', lines('msg <- "ÃƒÂ¤ÃƒÂ¶ÃƒÂ¼"', 'print(msg)')),
					file('b.R', lines('x <- 42', 'print(x)'))
				],
				step(
					file('a.R', lines('msg <- "ÃƒÂ¤ÃƒÂ¶ÃƒÂ¼Ã¢â€šÂ¬"', 'print(msg)')),
					file('b.R', lines('x <- 42', 'print(x)'))
				)
			));

			executeAndCompareScenario(scenario(
				'editing inside a nested construct in one file and at top level in another',
				[
					file('a.R', lines('f <- function(x) {', '\ty <- x + 1', '\tprint(y)', '}')),
					file('b.R', lines('z <- 3', 'print(z)'))
				],
				step(
					file('a.R', lines('f <- function(x) {', '\ty <- x * 2', '\tprint(y)', '}')),
					file('b.R', lines('z <- 3', 'z <- z + 1', 'print(z)'))
				)
			));

			executeAndCompareScenario(scenario(
				'editing only one of two syntactically invalid files',
				[
					file('a.R', 'print('),
					file('b.R', 'x <-')
				],
				step(
					file('a.R', 'print(1)'),
					file('b.R', 'x <-')
				)
			));

		});
	});

	describe('multiple update sets', () => {
		describe('single-file', () => {
			executeAndCompareScenario(scenario(
				'keeps the cached pipeline across an empty update step before a later real edit',
				[file('a.R', 'x <- 1')],
				step(),
				step(file('a.R', 'x <- 2'))
			));

			executeAndCompareScenario(scenario(
				'reuses the previous tree for a no-op invalidation after a prior real edit',
				[file('a.R', 'x <- 1')],
				step(file('a.R', 'x <- 10')),
				step(file('a.R', 'x <- 10'))
			));

			executeAndCompareScenario(scenario(
				'handles multiple updates in one step whose final content matches the original content',
				[file('a.R', 'x <- 1')],
				step(
					file('a.R', 'x <- 10'),
					file('a.R', 'x <- 1')
				)
			));

			executeAndCompareScenario(scenario(
				'recovers across valid, invalid, cached, and valid states on the same analyzer instance',
				[file('a.R', 'x <- 1')],
				step(file('a.R', 'x <-')),
				step(),
				step(file('a.R', 'x <- 1'))
			));
		});

		describe('multi-file', () => {
			executeAndCompareScenario(scenario(
				'keeps the cached pipeline on an empty step before changing only one file',
				[
					file('a.R', 'x <- 1'),
					file('b.R', 'y <- 2')
				],
				step(),
				step(
					file('a.R', 'x <- 10'),
					file('b.R', 'y <- 2')
				)
			));

			executeAndCompareScenario(scenario(
				'handles a no-op invalidation for one file while another file changes in the next step',
				[
					file('a.R', 'x <- 1'),
					file('b.R', 'y <- 2')
				],
				step(
					file('a.R', 'x <- 10'),
					file('b.R', 'y <- 2')
				),
				step(
					file('a.R', 'x <- 10'),
					file('b.R', 'y <- 20')
				)
			));

			executeAndCompareScenario(scenario(
				'handles repeated updates to one file in a step while another file ends up truly changed',
				[
					file('a.R', 'x <- 1'),
					file('b.R', 'y <- 2')
				],
				step(
					file('a.R', 'x <- 10'),
					file('a.R', 'x <- 1'),
					file('b.R', 'y <- 20')
				)
			));

			executeAndCompareScenario(scenario(
				'switches which file changes across successive steps while the other is reused',
				[
					file('a.R', lines('x <- 1', 'print(x)')),
					file('b.R', lines('y <- 2', 'print(y)'))
				],
				step(
					file('a.R', lines('x <- 10', 'print(x)')),
					file('b.R', lines('y <- 2', 'print(y)'))
				),
				step(
					file('a.R', lines('x <- 10', 'print(x)')),
					file('b.R', lines('y <- 20', 'print(y)'))
				)
			));
		});
	});
});
