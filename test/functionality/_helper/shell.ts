import type { MergeableRecord } from '../../../src/util/objects';
import { deepMergeObject } from '../../../src/util/objects';
import { NAIVE_RECONSTRUCT } from '../../../src/core/steps/all/static-slicing/10-reconstruct';
import { guard } from '../../../src/util/assert';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import type { TestLabel, TestLabelContext } from './label';
import { modifyLabelName , decorateLabelContext } from './label';
import { printAsBuilder } from './dataflow/dataflow-builder-printer';
import { RShell } from '../../../src/r-bridge/shell';
import type { NoInfo, RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import type { fileProtocol, RParseRequests } from '../../../src/r-bridge/retriever';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type {
	AstIdMap, IdGenerator, NormalizedAst,
	RNodeWithParent
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	deterministicCountingIdGenerator
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE,
	DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE,
	DEFAULT_DATAFLOW_PIPELINE,
	DEFAULT_NORMALIZE_PIPELINE, TREE_SITTER_NORMALIZE_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines';


import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { DataflowDifferenceReport, ProblematicDiffInfo } from '../../../src/dataflow/graph/diff';
import { diffOfDataflowGraphs } from '../../../src/dataflow/graph/diff';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../src/dataflow/graph/graph';
import { diffGraphsToMermaidUrl, graphToMermaidUrl } from '../../../src/util/mermaid/dfg';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { normalizedAstToMermaidUrl } from '../../../src/util/mermaid/ast';
import type { AutoSelectPredicate } from '../../../src/reconstruct/auto-select/auto-select-defaults';
import { resolveDataflowGraph } from '../../../src/dataflow/graph/resolve-graph';
import { assert, test, describe, afterAll, beforeAll } from 'vitest';
import semver from 'semver/preload';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';

export const testWithShell = (msg: string, fn: (shell: RShell, test: unknown) => void | Promise<void>) => {
	return test(msg, async function(this: unknown): Promise<void> {
		let shell: RShell | null = null;
		try {
			shell = new RShell();
			await fn(shell, this);
		} finally {
			// ensure we close the shell in error cases too
			shell?.close();
		}
	});
};


let testShell: RShell | undefined = undefined;

/**
 * produces a shell session for you, can be used within a `describe` block
 * @param fn       - function to use the shell
 * @param newShell - whether to create a new shell or reuse a global shell instance for the tests
 */
export function withShell(fn: (shell: RShell) => void, newShell = false): () => void {
	if(!newShell && testShell === undefined) {
		testShell = new RShell();
		process.on('exit', () => {
			testShell?.close();
		});
		process.on('SIGTERM', () => {
			testShell?.close();
		});
	}
	return function() {
		if(newShell) {
			const shell = new RShell();
			afterAll(() => shell.close());
			fn(shell);
		} else {
			fn(testShell as RShell);
		}
	};
}

function removeInformation<T extends Record<string, unknown>>(obj: T, includeTokens: boolean, ignoreColumns: boolean, ignoreMisc: boolean): T {
	return JSON.parse(JSON.stringify(obj, (key, value) => {
		if(key === 'fullRange' || ignoreMisc && (key === 'fullLexeme' || key === 'id' || key === 'parent' || key === 'index' || key === 'role' || key === 'nesting')) {
			return undefined;
		} else if(key === 'additionalTokens' && (!includeTokens || (Array.isArray(value) && value.length === 0))) {
			return undefined;
		} else if(ignoreColumns && (key == 'location' || key == 'fullRange') && Array.isArray(value) && value.length === 4) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			value = [value[0], 0, value[2], 0];
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return value;
	})) as T;
}


function assertAstEqual<Info>(ast: RNode<Info>, expected: RNode<Info>, includeTokens: boolean, ignoreColumns: boolean, message?: () => string, ignoreMiscSourceInfo = true): void {
	ast = removeInformation(ast, includeTokens, ignoreColumns, ignoreMiscSourceInfo);
	expected = removeInformation(expected, includeTokens, ignoreColumns, ignoreMiscSourceInfo);
	try {
		assert.deepStrictEqual(ast, expected);
	} catch(e) {
		if(message) {
			console.error(message());
		}
		throw e;
	}
}

export const retrieveNormalizedAst = async(shell: RShell, input: `${typeof fileProtocol}${string}` | string): Promise<NormalizedAst> => {
	const request = requestFromInput(input);
	return (await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
		parser:	shell,
		request
	}).allRemainingSteps()).normalize;
};

export interface TestConfiguration extends MergeableRecord {
	/** the (inclusive) minimum version of R required to run this test, e.g., {@link MIN_VERSION_PIPE} */
	minRVersion:            string | undefined
	needsXmlParseData:      boolean
	needsNetworkConnection: boolean
}

export interface TestConfigurationWithOutput extends TestConfiguration {
	/** HANDLE WITH UTTER CARE! Will run in an R-Shell on the host system! */
	expectedOutput: string | RegExp
	trimOutput:     boolean
}

export const defaultTestConfiguration: TestConfiguration = {
	minRVersion:            undefined,
	needsXmlParseData:      false,
	needsNetworkConnection: false
};


/** Automatically skip a test if no internet connection is available */
function skipTestBecauseNoNetwork(): boolean {
	if(!globalThis.hasNetwork) {
		console.warn('Skipping test because no internet connection is available');
		return true;
	}
	return false;
}


/**
 * Automatically skip a test if it does not satisfy the given version pattern
 * (for a [semver](https://www.npmjs.com/package/semver) version).
 *
 * @param versionToSatisfy - The version pattern to satisfy (e.g., `"<= 4.0.0 || 5.0.0 - 6.0.0"`)
 */
function skipTestBecauseInsufficientRVersion(versionToSatisfy: string): boolean {
	if(!globalThis.rVersion || !semver.satisfies(globalThis.rVersion, versionToSatisfy)) {
		console.warn(`Skipping test because ${JSON.stringify(globalThis.rVersion?.raw)} does not satisfy ${JSON.stringify(versionToSatisfy)}.`);
		return true;
	}
	return false;
}


function skipTestBecauseXmlParseDataIsMissing(): boolean {
	if(!globalThis.hasXmlParseData) {
		console.warn('Skipping test because package "xmlparsedata" is not installed (install it locally to get the tests to run).');
		return true;
	}
	return false;
}



export function skipTestBecauseConfigNotMet(userConfig?: Partial<TestConfiguration>): boolean {
	const config = deepMergeObject(defaultTestConfiguration, userConfig);
	return config.needsNetworkConnection && skipTestBecauseNoNetwork()
		|| config.minRVersion !== undefined && skipTestBecauseInsufficientRVersion(`>=${config.minRVersion}`)
		|| config.needsXmlParseData && skipTestBecauseXmlParseDataIsMissing();
}

/**
 * Comfort for {@link assertAst} to run the same test for multiple steps
 */
export function sameForSteps<T, S>(steps: S[], wanted: T): { step: S, wanted: T }[] {
	return steps.map(step => ({ step, wanted }));
}

/**
 * For a given input code this takes multiple ASTs depending on the respective normalizer step to run!
 *
 * @see sameForSteps
 */
export function assertAst(name: TestLabel | string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration & {
	ignoreAdditionalTokens: boolean,
	ignoreColumns:          boolean,
	skipTreeSitter:         boolean
}>) {
	const skip = skipTestBecauseConfigNotMet();
	const labelContext: TestLabelContext[] = skip ? [] : ['desugar-shell'];
	const skipTreeSitter = userConfig?.skipTreeSitter;
	if(!skipTreeSitter) {
		labelContext.push('desugar-tree-sitter');
	}
	// the ternary operator is to support the legacy way I wrote these tests - by mirroring the input within the name
	return describe.skipIf(skip)(`${decorateLabelContext(name, labelContext)} (input: ${input})`, () => {
		let shellAst: RNode | undefined;
		let tsAst: RNode | undefined;
		beforeAll(async() => {
			shellAst = await makeShellAst();
			if(!skipTreeSitter) {
				tsAst = await makeTsAst();
			}
		});
		test('shell', function() {
			assertAstEqual(shellAst as RNode, expected, !userConfig?.ignoreAdditionalTokens, userConfig?.ignoreColumns === true,
				() => `got: ${JSON.stringify(shellAst)}, vs. expected: ${JSON.stringify(expected)}`);
		});
		test.skipIf(skipTreeSitter)('tree-sitter', function() {
			assertAstEqual(tsAst as RNode, expected, !userConfig?.ignoreAdditionalTokens, userConfig?.ignoreColumns === true,
				() => `got: ${JSON.stringify(tsAst)}, vs. expected: ${JSON.stringify(expected)}`);
		});
		test.skipIf(skipTreeSitter)('compare', function() {
			// we still ignore columns because we know those to be different (tree-sitter crushes tabs at the start of lines)
			assertAstEqual(tsAst as RNode, shellAst as RNode, true, userConfig?.ignoreColumns === true,
				() => `tree-sitter ast: ${JSON.stringify(tsAst)}, vs. shell ast: ${JSON.stringify(shellAst)}`, false);
		});
	});

	async function makeShellAst(): Promise<RNode> {
		const pipeline = new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			parser:  shell,
			request: requestFromInput(input)
		});
		const result = await pipeline.allRemainingSteps();
		return result.normalize.ast;
	}

	async function makeTsAst(): Promise<RNode> {
		const pipeline = new PipelineExecutor(TREE_SITTER_NORMALIZE_PIPELINE, {
			parser:  new TreeSitterExecutor(),
			request: requestFromInput(input)
		});
		const result = await pipeline.allRemainingSteps();
		return result.normalize.ast;
	}
}

/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(name, async function() {
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   deterministicCountingIdGenerator(startIndexForDeterministicIds),
			parser:  shell,
			request: requestFromInput(input),
		}).allRemainingSteps();

		const ast = result.normalize.ast;

		assertAstEqual(ast, expected, false, false, () => `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`);
	});
}

function mapProblematicNodesToIds(problematic: readonly ProblematicDiffInfo[] | undefined): Set<NodeId> | undefined {
	return problematic === undefined ? undefined : new Set(problematic.map(p => p.tag === 'vertex' ? p.id : `${p.from}->${p.to}`));
}


/**
 * Assert that the given input code produces the expected output in R. Trims by default.
 */
export function assertOutput(name: string | TestLabel, shell: RShell, input: string | RParseRequests, expected: string | RegExp, userConfig?: Partial<TestConfigurationWithOutput>): void {
	if(typeof input !== 'string') {
		throw new Error('Currently, we have no support for expecting the output of arbitrary requests');
	}
	const effectiveName = decorateLabelContext(name, ['output']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${input})`, async function() {
		const lines = await shell.sendCommandWithOutput(input, { automaticallyTrimOutput: userConfig?.trimOutput ?? true });
		/* we have to reset in between such tests! */
		shell.clearEnvironment();
		if(typeof expected === 'string') {
			assert.strictEqual(lines.join('\n'), expected, `for input ${input}`);
		} else {
			assert.match(lines.join('\n'), expected,`, for input ${input}`);
		}
	});
}

function handleAssertOutput(name: string | TestLabel, shell: RShell, input: string | RParseRequests, userConfig?: Partial<TestConfigurationWithOutput>): void {
	const e = userConfig?.expectedOutput;
	if(e) {
		assertOutput(modifyLabelName(name, n => `[output] ${n}`), shell, input, e, userConfig);
	}
}

interface DataflowTestConfiguration extends TestConfigurationWithOutput {
	/**
	 * Specify just a subset of what the dataflow graph will actually be.
	 */
	expectIsSubgraph:      boolean,
	/**
	 * This changes the way the test treats the {@link NodeId}s in your expected graph.
	 * Before running the verification, the test environment will transform the graph,
	 * resolving all Ids as if they are slicing criteria.
	 * In other words, you can use the criteria `12@a` which will be resolved to the corresponding id before comparing.
	 * Please be aware that this is currently a work in progress.
	 */
	resolveIdsAsCriterion: boolean
}

function cropIfTooLong(str: string): string {
	return str.length > 100 ? str.substring(0, 100) + '...' : str;
}

export function assertDataflow(
	name: string | TestLabel,
	shell: RShell,
	input: string | RParseRequests,
	expected: DataflowGraph,
	userConfig?: Partial<DataflowTestConfiguration>,
	startIndexForDeterministicIds = 0
): void {
	const effectiveName = decorateLabelContext(name, ['dataflow']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${cropIfTooLong(JSON.stringify(input))})`, async function() {
		const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: typeof input === 'string' ? requestFromInput(input) : input,
			getId:   deterministicCountingIdGenerator(startIndexForDeterministicIds)
		}).allRemainingSteps();

		// assign the same id map to the expected graph, so that resolves work as expected
		expected.setIdMap(info.normalize.idMap);

		if(userConfig?.resolveIdsAsCriterion) {
			expected = resolveDataflowGraph(expected);
		}

		const report: DataflowDifferenceReport = diffOfDataflowGraphs(
			{ name: 'expected', graph: expected },
			{ name: 'got',      graph: info.dataflow.graph },
			{
				leftIsSubgraph: userConfig?.expectIsSubgraph
			}
		);
		// with the try catch the diff graph is not calculated if everything is fine
		try {
			guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
		} catch(e) {
			const diff = diffGraphsToMermaidUrl(
				{ label: 'expected', graph: expected, mark: mapProblematicNodesToIds(report.problematic()) },
				{ label: 'got', graph: info.dataflow.graph, mark: mapProblematicNodesToIds(report.problematic()) },
				`%% ${JSON.stringify(input).replace(/\n/g, '\n%% ')}\n` + report.comments()?.map(n => `%% ${n}\n`).join('') + '\n'
			);

			console.error('ast', normalizedAstToMermaidUrl(info.normalize.ast));

			console.error('best-effort reconstruction:\n', printAsBuilder(info.dataflow.graph));

			console.error('diff:\n', diff);
			throw e;
		}
	});
	handleAssertOutput(name, shell, input, userConfig);
}


/** call within describeSession */
function printIdMapping(ids: NodeId[], map: AstIdMap): string {
	return ids.map(id => `${id}: ${JSON.stringify(map.get(id)?.lexeme)}`).join(', ');
}

/**
 * Please note that this executes the reconstruction step separately, as it predefines the result of the slice with the given ids.
 */
export function assertReconstructed(name: string | TestLabel, shell: RShell, input: string, ids: NodeId | NodeId[], expected: string, userConfig?: Partial<TestConfigurationWithOutput>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)) {
	const selectedIds = Array.isArray(ids) ? ids : [ids];
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(decorateLabelContext(name, ['slice']), async function(this: unknown) {
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   getId,
			request: requestFromInput(input),
			parser:  shell
		}).allRemainingSteps();
		const reconstructed = NAIVE_RECONSTRUCT.processor({
			normalize: result.normalize,
			slice:     {
				decodedCriteria:   [],
				timesHitThreshold: 0,
				result:            new Set(selectedIds)
			}
		}, {});
		assert.strictEqual(reconstructed.code, expected,
			`got: ${reconstructed.code}, vs. expected: ${expected}, for input ${input} (ids ${JSON.stringify(ids)}:\n${[...result.normalize.idMap].map(i => `${i[0]}: '${i[1].lexeme}'`).join('\n')})`);
	});
	handleAssertOutput(name, shell, input, userConfig);
}


export function assertSliced(
	name: string | TestLabel,
	shell: RShell,
	input: string,
	criteria: SlicingCriteria,
	expected: string,
	userConfig?: Partial<TestConfigurationWithOutput> & { autoSelectIf?: AutoSelectPredicate, skipTreeSitter?: boolean },
	getId: () => IdGenerator<NoInfo> = () => deterministicCountingIdGenerator(0)
) {
	const fullname = `${JSON.stringify(criteria)} ${decorateLabelContext(name, ['slice'])}`;
	const skip = skipTestBecauseConfigNotMet(userConfig);
	describe.skipIf(skip)(fullname, () => {
		let shellResult: PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE> | undefined;
		let tsResult: PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE> | undefined;
		beforeAll(async() => {
			shellResult = await new PipelineExecutor(DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE, {
				getId:        getId(),
				request:      requestFromInput(input),
				parser:       shell,
				criterion:    criteria,
				autoSelectIf: userConfig?.autoSelectIf,
			}).allRemainingSteps();
			if(!userConfig?.skipTreeSitter) {
				tsResult = await new PipelineExecutor(TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE, {
					getId:        getId(),
					request:      requestFromInput(input),
					parser:       new TreeSitterExecutor(),
					criterion:    criteria,
					autoSelectIf: userConfig?.autoSelectIf
				}).allRemainingSteps();
			}
		});
		test('shell', () => testSlice(shellResult as PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE>));
		test.skipIf(userConfig?.skipTreeSitter)('tree-sitter', () => testSlice(tsResult as PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>));
		test.skipIf(userConfig?.skipTreeSitter)('compare', function() {
			const tsAst = tsResult?.normalize.ast as RNodeWithParent;
			const shellAst = shellResult?.normalize.ast as RNodeWithParent;
			assertAstEqual(tsAst, shellAst, true, true, () => `tree-sitter ast: ${JSON.stringify(tsAst)} (${normalizedAstToMermaidUrl(tsAst)}), vs. shell ast: ${JSON.stringify(shellAst)} (${normalizedAstToMermaidUrl(shellAst)})`, false);
		});
	});
	handleAssertOutput(name, shell, input, userConfig);

	function testSlice(result: PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE | typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>) {
		try {
			assert.strictEqual(
				result.reconstruct.code, expected,
				`got: ${result.reconstruct.code}, vs. expected: ${expected}, for input ${input} (slice for ${JSON.stringify(criteria)}: ${printIdMapping(result.slice.decodedCriteria.map(({ id }) => id), result.normalize.idMap)}), url: ${graphToMermaidUrl(result.dataflow.graph, true, result.slice.result)}`
			);
		} catch(e) {
			console.error(`got:\n${result.reconstruct.code}\nvs. expected:\n${expected}`);
			console.error(normalizedAstToMermaidUrl(result.normalize.ast));
			throw e;
		}
	}
}
