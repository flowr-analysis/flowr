import { type MergeableRecord , deepMergeObject } from '../../../src/util/objects';
import { NAIVE_RECONSTRUCT } from '../../../src/core/steps/all/static-slicing/10-reconstruct';
import { guard, isNotUndefined } from '../../../src/util/assert';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { type TestLabel, type TestLabelContext , decorateLabelContext, dropTestLabel, modifyLabelName } from './label';
import { printAsBuilder } from './dataflow/dataflow-builder-printer';
import { RShell } from '../../../src/r-bridge/shell';
import type { NoInfo, RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import { type fileProtocol, type RParseRequests , requestFromInput } from '../../../src/r-bridge/retriever';
import {
	type AstIdMap,
	type IdGenerator,
	type NormalizedAst,
	type RNodeWithParent
	, deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE,
	type TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE
	,
	createSlicePipeline,
	DEFAULT_NORMALIZE_PIPELINE,
	TREE_SITTER_NORMALIZE_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { diffOfDataflowGraphs } from '../../../src/dataflow/graph/diff-dataflow-graph';
import { type NodeId , normalizeIdToNumberIfPossible } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowGraph } from '../../../src/dataflow/graph/graph';
import { diffGraphsToMermaidUrl, graphToMermaidUrl } from '../../../src/util/mermaid/dfg';
import { type SingleSlicingCriterion, type SlicingCriteria , slicingCriterionToId } from '../../../src/slicing/criterion/parse';
import { normalizedAstToMermaidUrl } from '../../../src/util/mermaid/ast';
import type { AutoSelectPredicate } from '../../../src/reconstruct/auto-select/auto-select-defaults';
import { resolveDataflowGraph } from '../../../src/dataflow/graph/resolve-graph';
import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import semver from 'semver/preload';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import type { FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import type { ContainerIndex } from '../../../src/dataflow/graph/vertex';
import type { REnvironmentInformation } from '../../../src/dataflow/environments/environment';
import { resolveByName } from '../../../src/dataflow/environments/resolve-by-name';
import type { GraphDifferenceReport, ProblematicDiffInfo } from '../../../src/util/diff-graph';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { type CfgProperty , assertCfgSatisfiesProperties } from '../../../src/control-flow/cfg-properties';
import { type FlowrConfigOptions , cloneConfig, defaultConfigOptions } from '../../../src/config';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { ReadonlyFlowrAnalysisProvider } from '../../../src/project/flowr-analyzer';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { SliceDirection } from '../../../src/core/steps/all/static-slicing/00-slice';

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
 * Produces a shell session for you, can be used within a `describe` block.
 * Please use **describe.sequential** as the RShell does not fare well with parallelization.
 * @param fn       - function to use the shell
 * @param newShell - whether to create a new shell or reuse a global shell instance for the tests
 * @see {@link withTreeSitter}
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

/**
 * This is the convenience sister-function to {@link withShell}.
 * It provides you with a {@link TreeSitterExecutor} instance.
 */
export function withTreeSitter(fn: (shell: TreeSitterExecutor) => void): () => void {
	const parser = new TreeSitterExecutor();
	afterAll(() => parser.close());
	return function() {
		fn(parser);
	};
}

function removeInformation<T extends Record<string, unknown>>(obj: T, includeTokens: boolean, ignoreColumns: boolean, ignoreMisc: boolean): T {
	return JSON.parse(JSON.stringify(obj, (key, value) => {
		if(key === 'fullRange' || ignoreMisc && (key === 'fullLexeme' || key === 'id' || key === 'parent' || key === 'index' || key === 'role' || key === 'nesting')) {
			return undefined;
		} else if(key === 'additionalTokens' && (!includeTokens || (Array.isArray(value) && value.length === 0))) {
			return undefined;
		} else if(ignoreColumns && (key == 'location' || key == 'fullRange') && Array.isArray(value) && value.length === 4) {
			value = [value[0], 0, value[2], 0];
		} else if(key === 'treeSitterId') {
			// we ignore tree-sitter-specific metadata
			return undefined;
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
		parser:   shell,
		requests: request
	}, defaultConfigOptions).allRemainingSteps()).normalize;
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




/**
 *
 */
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
 * For a given input code, this takes multiple ASTs depending on the respective normalizer step to run!
 * @see sameForSteps
 */
export function assertAst(name: TestLabel | string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration & {
	ignoreAdditionalTokens: boolean,
	ignoreColumns:          boolean,
	skipTreeSitter:         boolean
}>) {
	const skip = skipTestBecauseConfigNotMet(userConfig);
	const labelContext: TestLabelContext[] = skip ? [] : ['desugar-shell'];
	const skipTreeSitter = userConfig?.skipTreeSitter;
	if(!skipTreeSitter) {
		labelContext.push('desugar-tree-sitter');
	}
	// the ternary operator is to support the legacy way I wrote these tests - by mirroring the input within the name
	return describe.skipIf(skip)(`${decorateLabelContext(name, labelContext)} (input: ${input})`, () => {
		const ts = !skipTreeSitter ? new TreeSitterExecutor() : undefined;
		let shellAst: RNode | undefined;
		let tsAst: RNode | undefined;
		beforeAll(async() => {
			shellAst = await makeShellAst();
			if(!skipTreeSitter) {
				tsAst = await makeTsAst();
			}
		});
		afterAll(() => ts?.close());
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

		async function makeShellAst(): Promise<RNode> {
			const pipeline = new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
				parser:   shell,
				requests: requestFromInput(input)
			}, defaultConfigOptions);
			const result = await pipeline.allRemainingSteps();
			return result.normalize.ast;
		}

		async function makeTsAst(): Promise<RNode> {
			const pipeline = new PipelineExecutor(TREE_SITTER_NORMALIZE_PIPELINE, {
				parser:   ts as TreeSitterExecutor,
				requests: requestFromInput(input)
			}, defaultConfigOptions);
			const result = await pipeline.allRemainingSteps();
			return result.normalize.ast;
		}
	});
}

/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(name, async function() {
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:    deterministicCountingIdGenerator(startIndexForDeterministicIds),
			parser:   shell,
			requests: requestFromInput(input),
		}, defaultConfigOptions).allRemainingSteps();

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

/**
 * Your best friend whenever you want to test whether the dataflow graph produced by flowR is as expected.
 *
 * You may want to have a look at the {@link DataflowTestConfiguration} to see what you can configure.
 * Especially the `resolveIdsAsCriterion` and the `expectIsSubgraph` are interesting as they allow you for rather
 * flexible matching of the expected graph.
 */
export function assertDataflow(
	name: string | TestLabel,
	shell: RShell,
	input: string | RParseRequests,
	expected: DataflowGraph | ((input: ReadonlyFlowrAnalysisProvider) => Promise<DataflowGraph>),
	userConfig?: Partial<DataflowTestConfiguration>,
	startIndexForDeterministicIds = 0,
	config = cloneConfig(defaultConfigOptions)
): void {
	const effectiveName = decorateLabelContext(name, ['dataflow']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${cropIfTooLong(JSON.stringify(input))})`, async function() {
		const analyzer = await new FlowrAnalyzerBuilder(typeof input === 'string' ? requestFromInput(input) : input)
			.setInput({
				getId: deterministicCountingIdGenerator(startIndexForDeterministicIds)
			})
			.setConfig(config)
			.setParser(shell)
			.build();

		if(typeof expected === 'function') {
			expected = await expected(analyzer);
		}

		const normalize = await analyzer.normalize();
		const dataflow = await analyzer.dataflow();

		// assign the same id map to the expected graph, so that resolves work as expected
		expected.setIdMap(normalize.idMap);

		if(userConfig?.resolveIdsAsCriterion) {
			expected = resolveDataflowGraph(expected);
		}

		const report: GraphDifferenceReport = diffOfDataflowGraphs(
			{ name: 'expected', graph: expected },
			{ name: 'got',      graph: dataflow.graph },
			{
				leftIsSubgraph: userConfig?.expectIsSubgraph
			}
		);
		// with the try catch the diff graph is not calculated if everything is fine
		try {
			guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
		} /* v8 ignore start */ catch(e) {
			const diff = diffGraphsToMermaidUrl(
				{ label: 'expected', graph: expected, mark: mapProblematicNodesToIds(report.problematic()) },
				{ label: 'got', graph: dataflow.graph, mark: mapProblematicNodesToIds(report.problematic()) },
				`%% ${JSON.stringify(input).replace(/\n/g, '\n%% ')}\n` + report.comments()?.map(n => `%% ${n}\n`).join('') + '\n'
			);

			console.error('ast', normalizedAstToMermaidUrl(normalize.ast));

			console.error('best-effort reconstruction:\n', printAsBuilder(dataflow.graph));

			console.error('diff:\n', diff);
			throw e;
		} /* v8 ignore stop */
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
			getId:    getId,
			requests: requestFromInput(input),
			parser:   shell
		}, defaultConfigOptions).allRemainingSteps();
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

function testWrapper(skip: boolean | undefined, shouldFail: boolean, testName: string, testFunction: () => void) {
	if(skip) {
		test.skip(testName, testFunction);
	} else if(shouldFail) {
		test.fails(testName, testFunction);
	} else {
		test(testName, testFunction);
	}
}

export type TestCaseFailType = 'fail-shell' | 'fail-tree-sitter' | 'fail-both' | undefined;

/**
 * This is a forward slicing convenience function that allows you to assert the result of a forward slice.
 * @see {@link assertSliced} - For the explanation of the parameters.
 */
export function assertSlicedF(
	name: TestLabel,
	shell: RShell,
	input: string,
	criteria: SlicingCriteria,
	expected: string | SingleSlicingCriterion[],
	testConfig?: Partial<TestConfigurationWithOutput & TestCaseParams>
) {
	return assertSliced(name, shell, input, criteria, expected, { ...testConfig, sliceDirection: SliceDirection.Forward });
}

interface TestCaseParams {
	/** Predicate allowing the inclusion of additional normalized nodes into the slice */
	autoSelectIf:         AutoSelectPredicate,
	/** Disable Tree-sitter tests */
	skipTreeSitter:       boolean,
	/** Whether to skip AST comparison tests between the RShell and Tree-sitter (only relevant when issues are known) */
	skipCompare:          boolean,
	/** Which CFG properties to exclude for CFG checks */
	cfgExcludeProperties: readonly CfgProperty[],
	/** Denotes whether the tests should fail in all cases or only for shell or Tree-sitter tests */
	testCaseFailType:     TestCaseFailType,
	/** The RNode ID generator */
	getId:                () => IdGenerator<NoInfo>,
	/** The flowr configuration to be used for the test */
	flowrConfig:          FlowrConfigOptions,
	/** The direction of the slice, defaults to forward */
	sliceDirection?:      SliceDirection
}

/**
 * Ensure that slicing for a given criteria returns the code you expect. Please be aware that for ease of use
 * this actually checks against the reconstructed code (which may contain additional tokens to support executability).
 * If you want to check against the actual ids, please provide an array of {@link SingleSlicingCriterion}s as the expected value.
 */
export function assertSliced(
	name: TestLabel,
	shell: RShell,
	input: string,
	criteria: SlicingCriteria,
	expected: string | SingleSlicingCriterion[],
	testConfig?: Partial<TestConfigurationWithOutput> & Partial<TestCaseParams>,
) {
	const fullname = `${JSON.stringify(criteria)} ${decorateLabelContext(name, ['slice'])}`;
	const skip = skipTestBecauseConfigNotMet(testConfig);
	if(skip || testConfig?.testCaseFailType === 'fail-both') {
		// drop it again because the test is not to be counted
		dropTestLabel(name);
	}
	describe.skipIf(skip)(fullname, () => {
		const ts = !testConfig?.skipTreeSitter ? new TreeSitterExecutor() : undefined;
		let shellResult: PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE> | undefined;
		let tsResult: PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE> | undefined;
		const getId = testConfig?.getId ?? (() => deterministicCountingIdGenerator(0));
		beforeAll(async() => {
			shellResult = await executePipeline(shell);
			if(!testConfig?.skipTreeSitter) {
				tsResult = await executePipeline(ts as TreeSitterExecutor);
			}
		});
		afterAll(() => ts?.close());

		testWrapper(
			false,
			testConfig?.testCaseFailType === 'fail-both' || testConfig?.testCaseFailType === 'fail-shell',
			'shell',
			() => testSlice(shellResult as PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE>, testConfig?.testCaseFailType !== 'fail-both' && testConfig?.testCaseFailType !== 'fail-shell'),
		);

		testWrapper(
			testConfig?.skipTreeSitter,
			testConfig?.testCaseFailType === 'fail-both' || testConfig?.testCaseFailType === 'fail-tree-sitter',
			'tree-sitter',
			() => testSlice(tsResult as PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>, testConfig?.testCaseFailType !== 'fail-both' && testConfig?.testCaseFailType !== 'fail-tree-sitter'),
		);

		testWrapper(
			testConfig?.skipTreeSitter || testConfig?.skipCompare,
			false,
			'compare ASTs',
			function() {
				const tsAst = tsResult?.normalize.ast as RNodeWithParent;
				const shellAst = shellResult?.normalize.ast as RNodeWithParent;
				assertAstEqual(tsAst, shellAst, true, true, () => `tree-sitter ast: ${JSON.stringify(tsAst)} (${normalizedAstToMermaidUrl(tsAst)}), vs. shell ast: ${JSON.stringify(shellAst)} (${normalizedAstToMermaidUrl(shellAst)})`, false);
			},
		);

		testWrapper(
			testConfig?.skipTreeSitter,
			false,
			'cfg SAT properties',
			function() {
				const res = tsResult as PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>;
				const cfg = extractCfg(res.normalize, defaultConfigOptions, res.dataflow.graph);
				const check = assertCfgSatisfiesProperties(cfg, testConfig?.cfgExcludeProperties);
				try {
					assert.isTrue(check, 'cfg fails properties: ' + check + ' is not satisfied');
				} catch(e: unknown) {
					console.error('cfg properties:', cfgToMermaidUrl(cfg, res.normalize));
					throw e;
				}
			}
		);

		handleAssertOutput(name, shell, input, testConfig);

		async function executePipeline(parser: KnownParser): Promise<PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE | typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>> {
			return await createSlicePipeline(parser, {
				getId:        getId(),
				requests:     requestFromInput(input),
				criterion:    criteria,
				autoSelectIf: testConfig?.autoSelectIf,
				direction:    testConfig?.sliceDirection
			}, cloneConfig(testConfig?.flowrConfig ?? defaultConfigOptions)).allRemainingSteps();
		}
		function testSlice(result: PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE | typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>, printError: boolean) {
			try {
				if(Array.isArray(expected)) {
					// check whether all ids are present in the slice result
					const decodedExpected = expected.map(e => slicingCriterionToId(e, result.normalize.idMap))
						.sort((a, b) => String(a).localeCompare(String(b)))
						.map(n => normalizeIdToNumberIfPossible(n));
					const inSlice = [...result.slice.result]
						.sort((a, b) => String(a).localeCompare(String(b)))
						.map(n => normalizeIdToNumberIfPossible(n));
					assert.deepStrictEqual(inSlice, decodedExpected, `expected ids ${JSON.stringify(decodedExpected)} are not in the slice result ${JSON.stringify(inSlice)}, for input ${input} (slice for ${printIdMapping(result.slice.decodedCriteria.map(({ id }) => id), result.normalize.idMap)}), url: ${graphToMermaidUrl(result.dataflow.graph, true, result.slice.result)}`);
				} else {
					assert.strictEqual(
						result.reconstruct.code, expected,
						`got: ${result.reconstruct.code}, vs. expected: ${JSON.stringify(expected)}, for input ${input} (slice for ${JSON.stringify(criteria)}: ${printIdMapping(result.slice.decodedCriteria.map(({ id }) => id), result.normalize.idMap)}), url: ${graphToMermaidUrl(result.dataflow.graph, true, result.slice.result)}`
					);
				}
			} /* v8 ignore start */ catch(e) {
				if(printError) {
					console.error(`got:\n${result.reconstruct.code}\nvs. expected:\n${JSON.stringify(expected)}`);
					console.error(normalizedAstToMermaidUrl(result.normalize.ast));
				}
				throw e;
			} /* v8 ignore stop */
		}
		handleAssertOutput(name, shell, input, testConfig);
	});
}

function findInDfg(id: NodeId, dfg: DataflowGraph): ContainerIndex[] | undefined {
	const vertex = dfg.getVertex(id);
	return vertex?.indicesCollection?.flatMap(collection => collection.indices);
}

function findInEnv(id: NodeId, ast: NormalizedAst, dfg: DataflowGraph, env: REnvironmentInformation): ContainerIndex[] | undefined {
	const name = ast.idMap.get(id)?.lexeme;
	if(!name) {
		return undefined;
	}
	const mayVertex = dfg.getVertex(id);
	const useEnv = mayVertex?.environment ?? env;
	const result = resolveByName(name, useEnv)?.flatMap(f => {
		if('indicesCollection' in f) {
			return f.indicesCollection?.flatMap(collection => collection.indices);
		} else {
			return undefined;
		}
	});
	if(result?.every(s => s === undefined)) {
		return undefined;
	} else {
		return result?.filter(isNotUndefined);
	}
}


/**
 *
 */
export function assertContainerIndicesDefinition(
	name: TestLabel,
	shell: RShell,
	input: string,
	search: FlowrSearchLike,
	expectedIndices: ContainerIndex[] | undefined,
	userConfig: Partial<TestConfiguration> & { searchIn: 'dfg' | 'env' | 'both' } = { searchIn: 'both' },
	config = cloneConfig(defaultConfigOptions),
) {
	const effectiveName = decorateLabelContext(name, ['dataflow']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${cropIfTooLong(JSON.stringify(input))})`, async function() {
		const analyzer = await new FlowrAnalyzerBuilder(requestFromInput(input))
			.setConfig(config)
			.setParser(shell)
			.build();
		const dataflow = await analyzer.dataflow();
		const normalize = await analyzer.normalize();
		const result = (await analyzer.runSearch(search)).getElements();
		let findIndices: (id: NodeId) => ContainerIndex[] | undefined;
		if(userConfig.searchIn === 'dfg') {
			findIndices = id => findInDfg(id, dataflow.graph);
		} else if(userConfig.searchIn === 'env') {
			findIndices = id => findInEnv(id, normalize, dataflow.graph, dataflow.environment);
		} else {
			findIndices = id => findInDfg(id, dataflow.graph) ?? findInEnv(id, normalize, dataflow.graph, dataflow.environment);
		}


		assert(result.length > 0, 'The result of the search was empty');

		for(const element of result) {
			const id = element.node.info.id;

			const actualIndices = findIndices(id);
			if(expectedIndices === undefined) {
				assert(actualIndices === undefined, `indices collection for vertex with id ${id} exists`);
				continue;
			}
			assert(actualIndices !== undefined, `indices collection for id ${id} doesn't exist`);

			const actual = stringifyIndices(actualIndices);
			const expected = stringifyIndices(expectedIndices);

			try {
				assert.strictEqual(
					actual, expected,
					`got: ${actual}, vs. expected: ${expected}, for input ${input}, url: ${graphToMermaidUrl(dataflow.graph, true)}`
				);
			} /* v8 ignore start */ catch(e) {
				console.error(`got:\n${actual}\nvs. expected:\n${expected}`);
				console.error(normalizedAstToMermaidUrl(normalize.ast));
				throw e;
			} /* v8 ignore stop */
		}
	});
}

function stringifyIndices(indices: ContainerIndex[]): string {
	return `[\n${indices.map(i => '  ' + JSON.stringify(i)).join('\n')}\n]`;
}
