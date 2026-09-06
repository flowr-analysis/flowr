import { deepMergeObject, type MergeableRecord } from '../../../src/util/objects';
import { NAIVE_RECONSTRUCT } from '../../../src/core/steps/all/static-slicing/10-reconstruct';
import { guard } from '../../../src/util/assert';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { decorateLabelContext, dropTestLabel, modifyLabelName, type TestLabel, type TestLabelContext } from './label';
import { printAsBuilder } from './dataflow/dataflow-builder-printer';
import { RShell } from '../../../src/r-bridge/shell';
import type { NoInfo, RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import type { fileProtocol, RParseRequests } from '../../../src/r-bridge/retriever';
import {
	type AstIdMap,
	deterministicCountingIdGenerator,
	type IdGenerator,
	type NormalizedAst,
	type ParentInformation,
	type RNodeWithParent
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	createSlicePipeline,
	DEFAULT_NORMALIZE_PIPELINE,
	type DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE,
	TREE_SITTER_NORMALIZE_PIPELINE,
	type TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../src/dataflow/graph/graph';
import { diffGraphsToMermaidUrl } from '../../../src/util/mermaid/dfg';
import type {
	SlicingCriteria } from '../../../src/slicing/criterion/parse';
import {
	SlicingCriterion
} from '../../../src/slicing/criterion/parse';
import { normalizedAstToMermaidUrl } from '../../../src/util/mermaid/ast';
import type { AutoSelectPredicate } from '../../../src/reconstruct/auto-select/auto-select-defaults';
import { afterAll, assert, beforeAll, describe, expect, test } from 'vitest';
import semver from 'semver/preload';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import type { GraphDifferenceReport, ProblematicDiffInfo } from '../../../src/util/diff-graph';
import { extractCfg } from '../../../src/control-flow/control-flow-graph';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { assertCfgSatisfiesProperties, type CfgProperty } from '../../../src/control-flow/cfg-properties';
import { FlowrConfig } from '../../../src/config';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../../src/project/flowr-analyzer';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import type { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import { SliceDirection } from '../../../src/util/slice-direction';
import { CallGraph } from '../../../src/dataflow/graph/call-graph';
import type { DeepWritable } from 'ts-essentials';

export const testWithShell = (msg: string, fn: (shell: RShell, test: unknown) => void | Promise<void>, timeout?: number) => {
	return test(msg, async function(this: unknown): Promise<void> {
		let shell: RShell | null = null;
		try {
			shell = new RShell();
			await fn(shell, this);
		} finally {
			// ensure we close the shell in error cases too
			shell?.close();
		}
	}, timeout);
};

let testShell: RShell | undefined = undefined;

/**
 * Produces a shell session for you, can be used within a `describe` block. Pass `{ concurrent: false }` to the
 * `describe`, the RShell does not fare well with parallelization.
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

function removeInformation<T extends RProject<unknown> | Record<string, unknown>>(obj: T, includeTokens: boolean, ignoreColumns: boolean, ignoreMisc: boolean): T {
	return JSON.parse(JSON.stringify(obj, (key, value) => {
		if(key === 'fullRange' || ignoreMisc && (key === 'fullLexeme' || key === 'id' || key === 'parent' || key === 'index' || key === 'role' || key === 'nest')) {
			return undefined;
		} else if(key === 'adToks' && (!includeTokens || (Array.isArray(value) && value.length === 0))) {
			return undefined;
		} else if(ignoreColumns && (key === 'location' || key === 'fullRange') && Array.isArray(value) && value.length === 4) {
			value = [value[0], 0, value[2], 0];
		} else if(key === 'tsId') {
			// we ignore tree-sitter-specific metadata
			return undefined;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return value;
	})) as T;
}

function assertAstEqual<Info>(ast: RProject<Info> | RNode<Info>, expected: RProject<Info> | RNode<Info>, includeTokens: boolean, ignoreColumns: boolean, message?: () => string, ignoreMiscSourceInfo = true): void {
	ast = removeInformation(ast, includeTokens, ignoreColumns, ignoreMiscSourceInfo);
	// eslint-disable-next-line flowr/replacement-pattern
	if(expected.type === RType.ExpressionList) {
		expected = {
			type: RType.Project,
			info: {
				/* we do not care for the id here */
				id: 'expected-root'
			},
			files: [{
				filePath: undefined,
				root:     expected
			}]
		};
	}
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

/**
 * this is an old, and nowadays outdated method to retrieve the normalized AST for a given input
 * Please prefer using the {@link FlowrAnalyzer} for new code!
 */
export const retrieveNormalizedAst = async(shell: RShell, input: `${typeof fileProtocol}${string}` | string): Promise<NormalizedAst> => {
	const context = contextFromInput(input);
	return (await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
		parser: shell,
		context
	}).allRemainingSteps()).normalize;
};

export interface TestConfiguration extends MergeableRecord {
	/** the (inclusive) minimum version of R required to run this test, e.g., {@link MIN_VERSION_PIPE} */
	minRVersion:            string | undefined
	needsNetworkConnection: boolean
	/** Packages this test's code may use without writing the `library()` call itself, as `solver.assumeAttachedPackages` states them. */
	assumeLoaded?:          readonly string[]
}

export interface TestConfigurationWithOutput extends TestConfiguration {
	/** HANDLE WITH UTTER CARE! Will run in an R-Shell on the host system! */
	expectedOutput:      string | RegExp
	/** What the reconstructed slice has to print when it runs. HANDLE WITH UTTER CARE! Will run in an R-Shell on the host system! */
	expectedSliceOutput: string | RegExp
	trimOutput:          boolean
}

export const defaultTestConfiguration: TestConfiguration = {
	minRVersion:            undefined,
	needsNetworkConnection: false
};

/** What {@link assumeLoadedPackages} declared, keyed by file so it does not leak into whichever one the (`isolate: false`) suite collects next. */
let collectingWithPackages: { file: string | undefined, packages: readonly string[] } = { file: undefined, packages: [] };

/** the test file currently being collected, which is what scopes a {@link assumeLoadedPackages} declaration */
function collectingFile(): string | undefined {
	return expect.getState().testPath;
}

/**
 * Declares the packages the tests in this file may use without attaching them themselves, as if the file had
 * opened with `library(pkg)`. Call once, at the top; a single test overrides this with its own {@link TestConfiguration.assumeLoaded}, `[]` included.
 */
export function assumeLoadedPackages(...packages: string[]): void {
	collectingWithPackages = { file: collectingFile(), packages };
}

/**
 * The packages a test runs with: its own {@link TestConfiguration.assumeLoaded} if set, otherwise what
 * {@link assumeLoadedPackages} declared for this file. Call only while the file is being collected.
 */
export function assumedPackagesOf(config: Pick<TestConfiguration, 'assumeLoaded'> | undefined): readonly string[] {
	if(config?.assumeLoaded !== undefined) {
		return config.assumeLoaded;
	}
	return collectingWithPackages.file === collectingFile() ? collectingWithPackages.packages : [];
}

/** Applies the packages a test runs with to `builder`. Pass what {@link assumedPackagesOf} returned at collection time. */
export function applyAssumedPackages<B extends { amendConfig(f: (c: DeepWritable<FlowrConfig>) => void): B }>(
	builder: B, assumed: readonly string[]
): B {
	return assumed.length === 0 ? builder : builder.amendConfig(c => {
		c.solver.assumeAttachedPackages = [...(c.solver.assumeAttachedPackages ?? []), ...assumed];
	});
}

/** `config` with `assumeLoaded` applied, so a test states the packages its snippet uses instead of attaching them itself. */
export function withAssumedPackages(config: FlowrConfig, assumeLoaded: readonly string[] | undefined): FlowrConfig {
	if(assumeLoaded === undefined || assumeLoaded.length === 0) {
		return config;
	}
	return FlowrConfig.amend(config, c => {
		c.solver.assumeAttachedPackages = [...(c.solver.assumeAttachedPackages ?? []), ...assumeLoaded];
	});
}

/** Automatically skip a test if no internet connection is available */
function skipTestBecauseNoNetwork(): boolean {
	if(!globalThis.hasNetwork) {
		console.warn('Skipping test because no internet connection is available');
		return true;
	}
	return false;
}

/** Automatically skip a test if it does not satisfy the given [semver](https://www.npmjs.com/package/semver) pattern (e.g. `"<= 4.0.0 || 5.0.0 - 6.0.0"`). */
function skipTestBecauseInsufficientRVersion(versionToSatisfy: string): boolean {
	if(!globalThis.rVersion || !semver.satisfies(globalThis.rVersion, versionToSatisfy)) {
		console.warn(`Skipping test because ${JSON.stringify(globalThis.rVersion?.raw)} does not satisfy ${JSON.stringify(versionToSatisfy)}.`);
		return true;
	}
	return false;
}

/** Automatically skip a test if the given configuration is not met */
export function skipTestBecauseConfigNotMet(userConfig?: Partial<TestConfiguration>): boolean {
	const config = deepMergeObject(defaultTestConfiguration, userConfig);
	return config.needsNetworkConnection && skipTestBecauseNoNetwork()
		|| config.minRVersion !== undefined && skipTestBecauseInsufficientRVersion(`>=${config.minRVersion}`);
}

/** Comfort for {@link assertAst} to run the same test for multiple steps */
export function sameForSteps<T, S>(steps: S[], wanted: T): { step: S, wanted: T }[] {
	return steps.map(step => ({ step, wanted }));
}

/**
 * For a given input code, this takes multiple ASTs depending on the respective normalizer step to run!
 * @see sameForSteps
 */
export function assertAst(name: TestLabel | string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration & {
	ignoreAdToks:   boolean,
	ignoreColumns:  boolean,
	skipTreeSitter: boolean
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
		let shellAst: RProject | undefined;
		let tsAst: RProject | undefined;
		beforeAll(async() => {
			shellAst = await makeShellAst();
			if(!skipTreeSitter) {
				tsAst = await makeTsAst();
			}
		});
		afterAll(() => ts?.close());
		test('shell', function() {
			assertAstEqual(shellAst as RProject, expected, !userConfig?.ignoreAdToks, userConfig?.ignoreColumns === true,
				() => `got: ${JSON.stringify(shellAst)}, vs. expected: ${JSON.stringify(expected)}`);
		});
		test.skipIf(skipTreeSitter)('tree-sitter', function() {
			assertAstEqual(tsAst as RProject, expected, !userConfig?.ignoreAdToks, userConfig?.ignoreColumns === true,
				() => `got: ${JSON.stringify(tsAst)}, vs. expected: ${JSON.stringify(expected)}`);
		});
		test.skipIf(skipTreeSitter)('compare', function() {
			// we still ignore columns because we know those to be different (tree-sitter crushes tabs at the start of lines)
			assertAstEqual(tsAst as RProject, shellAst as RProject, true, userConfig?.ignoreColumns === true,
				() => `tree-sitter ast: ${JSON.stringify(tsAst)}, vs. shell ast: ${JSON.stringify(shellAst)}`, false);
		});

		async function makeShellAst(): Promise<RProject> {
			const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, { parser: shell, context: contextFromInput(input) }).allRemainingSteps();
			return result.normalize.ast;
		}

		async function makeTsAst(): Promise<RProject> {
			const result = await new PipelineExecutor(TREE_SITTER_NORMALIZE_PIPELINE, { parser: ts as TreeSitterExecutor, context: contextFromInput(input) }).allRemainingSteps();
			return result.normalize.ast;
		}
	});
}

/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(name, async function() {
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   deterministicCountingIdGenerator(startIndexForDeterministicIds),
			parser:  shell,
			context: contextFromInput(input),
		}).allRemainingSteps();

		const ast = result.normalize.ast;

		assertAstEqual(ast, expected, false, false, () => `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`);
	});
}

/** Maps problematic nodes in a diff report to their ids for easier marking in mermaid graphs */
export function mapProblematicNodesToIds(problematic: readonly ProblematicDiffInfo[] | undefined): Set<NodeId> | undefined {
	return problematic === undefined ? undefined : new Set(problematic.map(p => p.tag === 'vertex' ? String(p.id) : `${p.from}->${p.to}`));
}

/** Assert that the given input code produces the expected output in R. Trims by default. */
export function assertOutput(name: string | TestLabel, parser: KnownParser, input: string | RParseRequests, expected: string | RegExp, userConfig?: Partial<TestConfigurationWithOutput>): void {
	if(typeof input !== 'string') {
		throw new Error('Currently, we have no support for expecting the output of arbitrary requests');
	}
	const effectiveName = decorateLabelContext(name, ['output']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${input})`, async function() {
		if(!(parser instanceof RShell)) {
			throw new Error(`Parser for output test must be an RShell, got ${parser.constructor.name}`);
		}
		const lines = await parser.sendCommandWithOutput(input, { automaticallyTrimOutput: userConfig?.trimOutput ?? true });
		/* we have to reset in between such tests! */
		parser.clearEnvironment();
		if(typeof expected === 'string') {
			assert.strictEqual(lines.join('\n'), expected, `for input ${input}`);
		} else {
			assert.match(lines.join('\n'), expected, `, for input ${input}`);
		}
	});
}

function handleAssertOutput(name: string | TestLabel, parser: KnownParser, input: string | RParseRequests, userConfig?: Partial<TestConfigurationWithOutput>): void {
	const e = userConfig?.expectedOutput;
	if(e) {
		assertOutput(modifyLabelName(name, n => `[output] ${n}`), parser, input, e, userConfig);
	}
}

interface DataflowTestConfiguration extends TestConfigurationWithOutput {
	/** Specify just a subset of what the dataflow graph will actually be. */
	expectIsSubgraph:      boolean,
	/**
	 * Before comparing, resolve every {@link NodeId} in the expected graph as if it were a slicing criterion (e.g.
	 * `12@a`). Still a work in progress.
	 */
	resolveIdsAsCriterion: boolean
	/** Which files to add to the project context */
	addFiles:              FlowrFileProvider[]
	/** The collection of vertex ids that should not exist */
	mustNotHaveVertices:   Set<NodeId>
	/** The collection of edges that should not exist, if criterias are enabled, these can be slicing criteria */
	mustNotHaveEdges:      [NodeId, NodeId][]
	/** Whether to test the call graph instead of the dataflow graph */
	context:               'dataflow' | 'call-graph',
	/** Allows you to modify the analyzer before running the test (assumes side-effects and reuses the same object if you return undefined). */
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	modifyAnalyzer:        (analyzer: FlowrAnalyzer) => FlowrAnalyzer | undefined | void
}

function cropIfTooLong(str: string): string {
	return str.length > 100 ? str.slice(0, 100) + '...' : str;
}

/**
 * Your best friend whenever you want to test whether the dataflow graph produced by flowR is as expected.
 * See {@link DataflowTestConfiguration} for what you can configure; `context: 'call-graph'` tests the call graph as a view of the dataflow graph.
 */
export function assertDataflow(
	name: string | TestLabel,
	parser: KnownParser,
	input: string | RParseRequests,
	expected: DataflowGraph | ((input: ReadonlyFlowrAnalysisProvider) => Promise<DataflowGraph>),
	userConfig?: Partial<DataflowTestConfiguration>,
	startIndexForDeterministicIds = 0,
	config = FlowrConfig.default()
): void {
	const effectiveName = decorateLabelContext(name, [userConfig?.context ?? 'dataflow']);
	const assumed = assumedPackagesOf(userConfig);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`${effectiveName} (input: ${cropIfTooLong(JSON.stringify(input))})`, async function() {
		let analyzer = await new FlowrAnalyzerBuilder()
			.setInput({
				getId: deterministicCountingIdGenerator(startIndexForDeterministicIds)
			})
			.setConfig(withAssumedPackages(config, assumed))
			.setParser(parser)
			.build();
		analyzer.addRequest(input);
		if(userConfig?.addFiles) {
			analyzer.addFile(...userConfig.addFiles);
		}

		if(userConfig?.modifyAnalyzer) {
			analyzer = userConfig.modifyAnalyzer(analyzer) ?? analyzer;
		}
		if(typeof expected === 'function') {
			expected = await expected(analyzer);
		}

		const normalize = await analyzer.normalize();
		const graph = userConfig?.context === 'call-graph' ? CallGraph.dropTransitiveEdges(await analyzer.callGraph()) : (await analyzer.dataflow()).graph;

		// assign the same id map to the expected graph, so that resolves work as expected
		expected.setIdMap(normalize.idMap);

		if(userConfig?.resolveIdsAsCriterion) {
			expected = Dataflow.resolveGraphCriteria(expected, analyzer.inspectContext());
		}

		const report: GraphDifferenceReport = Dataflow.diffGraphs(
			{ name: 'expected', graph: expected },
			{ name: 'got',      graph: graph },
			{
				leftIsSubgraph: userConfig?.expectIsSubgraph
			}
		);
		// with the try catch the diff graph is not calculated if everything is fine
		try {
			guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
			if(userConfig?.mustNotHaveVertices) {
				if(userConfig?.resolveIdsAsCriterion) {
					userConfig.mustNotHaveVertices = new Set(Array.from(userConfig.mustNotHaveVertices).map(id => {
						return SlicingCriterion.tryParse(id, normalize.idMap) ?? id;
					}));
				}
				for(const id of userConfig.mustNotHaveVertices) {
					guard(!graph.hasVertex(id), () => `Graph must not have vertex ${id}, but it exists.`);
				}
			}
			if(userConfig?.mustNotHaveEdges) {
				if(userConfig?.resolveIdsAsCriterion) {
					userConfig.mustNotHaveEdges = userConfig.mustNotHaveEdges.map(([from, to]) => {
						const resolvedFrom = SlicingCriterion.tryParse(from, normalize.idMap) ?? from;
						const resolvedTo = SlicingCriterion.tryParse(to, normalize.idMap) ?? to;
						return [resolvedFrom, resolvedTo] as [NodeId, NodeId];
					});
				}
				for(const [from, to] of userConfig.mustNotHaveEdges) {
					const out = graph.outgoingEdges(from);
					guard(!out?.has(to), () => `Graph must not have edge ${from} -> ${to}, but it exists.`);
				}
			}
		} /* v8 ignore start */ catch(e) {
			const diff = diffGraphsToMermaidUrl(
				{ label: 'expected', graph: expected, mark: mapProblematicNodesToIds(report.problematic()) },
				{ label: 'got', graph: graph, mark: mapProblematicNodesToIds(report.problematic()) },
				`%% ${JSON.stringify(input).replace(/\n/g, '\n%% ')}\n` + report.comments()?.map(n => `%% ${n}\n`).join('') + '\n'
			);

			console.error('ast', normalizedAstToMermaidUrl(normalize.ast));

			console.error('best-effort reconstruction:\n', printAsBuilder(graph));

			console.error('diff:\n', diff);
			throw e;
		} /* v8 ignore stop */
	});
	handleAssertOutput(name, parser, input, userConfig);
}

/** call within describeSession */
function printIdMapping(ids: readonly NodeId[], map: AstIdMap): string {
	return ids.map(id => `${id}: ${JSON.stringify(map.get(id)?.lexeme)}`).join(', ');
}

/** Note that this executes the reconstruction step separately, as it predefines the result of the slice with the given ids. */
export function assertReconstructed(name: string | TestLabel, shell: RShell, input: string, ids: NodeId | NodeId[], expected: string, userConfig?: Partial<TestConfigurationWithOutput>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)) {
	const selectedIds = Array.isArray(ids) ? ids : [ids];
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(decorateLabelContext(name, ['slice']), async function(this: unknown) {
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   getId,
			context: contextFromInput(input),
			parser:  shell
		}).allRemainingSteps();
		const reconstructed = NAIVE_RECONSTRUCT.processor({
			normalize: result.normalize,
			slice:     {
				slicedFor:         [],
				timesHitThreshold: 0,
				result:            new Set(selectedIds)
			}
		}, {});
		assert.strictEqual(reconstructed.code, expected,
			`got: ${reconstructed.code as string}, vs. expected: ${expected}, for input ${input} (ids ${JSON.stringify(ids)}:\n${[...result.normalize.idMap].map(i => `${i[0]}: '${i[1].lexeme}'`).join('\n')})`);
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
	expected: string | SlicingCriterion[],
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
	flowrConfig:          FlowrConfig,
	/** The direction of the slice, defaults to forward */
	sliceDirection?:      SliceDirection
	/** Continue backward slicing past a function-definition boundary, including the definition's binding and call sites */
	includeCallees?:      boolean
}

/**
 * Ensure that slicing for a given criteria returns the code you expect. Checks against the reconstructed code
 * (which may carry extra tokens for executability); pass an array of {@link SlicingCriterion}s to check ids instead.
 */
export function assertSliced(
	name: TestLabel,
	shell: RShell,
	input: string,
	criteria: SlicingCriteria,
	expected: string | SlicingCriterion[],
	testConfig?: Partial<TestConfigurationWithOutput> & Partial<TestCaseParams> & { addFiles?: FlowrFileProvider[], extendSlice?: boolean },
) {
	const fullname = `${JSON.stringify(criteria)} ${decorateLabelContext(name, ['slice'])}`;
	const assumed = assumedPackagesOf(testConfig);
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
				const tsAst = tsResult?.normalize.ast as RProject<ParentInformation>;
				const shellAst = shellResult?.normalize.ast as RProject<ParentInformation>;
				assertAstEqual(
					tsAst, shellAst, true, true,
					() => `tree-sitter ast: ${JSON.stringify(tsAst)} (${normalizedAstToMermaidUrl(tsAst)}), vs. shell ast: ${JSON.stringify(shellAst)} (${normalizedAstToMermaidUrl(shellAst)})`,
					false
				);
			},
		);

		testWrapper(
			testConfig?.skipTreeSitter,
			false,
			'cfg SAT properties',
			function() {
				const res = tsResult as PipelineOutput<typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>;
				const cfg = extractCfg(res.dataflow);
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
			const context =  contextFromInput(input, withAssumedPackages(FlowrConfig.clone(testConfig?.flowrConfig ?? FlowrConfig.default()), assumed));
			if(testConfig?.extendSlice) {
				FlowrConfig.setInConfigInPlace(context.config, 'solver.slicer.autoExtend', true);
			}
			if(testConfig?.addFiles) {
				context.addFiles(testConfig.addFiles);
			}
			return await createSlicePipeline(parser, {
				getId:          getId(),
				context:        context,
				criterion:      criteria,
				autoSelectIf:   testConfig?.autoSelectIf,
				direction:      testConfig?.sliceDirection,
				includeCallees: testConfig?.includeCallees
			}).allRemainingSteps();
		}
		function testSlice(result: PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE | typeof TREE_SITTER_SLICE_AND_RECONSTRUCT_PIPELINE>, printError: boolean) {
			try {
				if(Array.isArray(expected)) {
					// check whether all ids are present in the slice result
					const decodedExpected = expected.map(e => SlicingCriterion.parse(e, result.normalize.idMap))
						.sort((a, b) => String(a).localeCompare(String(b)))
						.map(NodeId.normalize);
					const inSlice = Array.from(result.slice.result)
						.sort((a, b) => String(a).localeCompare(String(b)))
						.map(NodeId.normalize);
					assert.deepStrictEqual(inSlice, decodedExpected, `expected ids ${JSON.stringify(decodedExpected)} are not in the slice result ${JSON.stringify(inSlice)}, for input ${input} (slice for ${printIdMapping(result.slice.slicedFor, result.normalize.idMap)}), url: ${Dataflow.visualize.mermaid.url(result.dataflow.graph, true, result.slice.result)}`);
				} else {
					assert.strictEqual(
						result.reconstruct.code, expected,
						`got: ${result.reconstruct.code as string}, vs. expected: ${JSON.stringify(expected)}, for input ${input} (slice for ${JSON.stringify(criteria)}: ${printIdMapping(result.slice.slicedFor, result.normalize.idMap)}), url: ${Dataflow.visualize.mermaid.url(result.dataflow.graph, true, result.slice.result)}`
					);
				}
				assert.strictEqual(result.slice.timesHitThreshold, 0, 'the slice shall not hit the threshold');
			} /* v8 ignore start */ catch(e) {
				if(printError) {
					console.error(`got:\n${result.reconstruct.code as string}\nvs. expected:\n${JSON.stringify(expected)}`);
					console.error(normalizedAstToMermaidUrl(result.normalize.ast));
				}
				throw e;
			} /* v8 ignore stop */
		}
		/* running the slice catches both a slice that drops what the criterion needs and one that does not parse */
		if(testConfig?.expectedSliceOutput !== undefined && testConfig?.testCaseFailType === undefined) {
			test('slice output', async() => {
				const reconstructed = (shellResult as PipelineOutput<typeof DEFAULT_SLICE_AND_RECONSTRUCT_PIPELINE>).reconstruct.code;
				const code = Array.isArray(reconstructed) ? reconstructed.join('\n') : reconstructed;
				const lines = await shell.sendCommandWithOutput(code, { automaticallyTrimOutput: testConfig?.trimOutput ?? true });
				/* we have to reset in between such tests! */
				shell.clearEnvironment();
				const expected = testConfig.expectedSliceOutput as string | RegExp;
				if(typeof expected === 'string') {
					assert.strictEqual(lines.join('\n'), expected, `the slice of ${JSON.stringify(input)} does not print what it has to, it is:\n${code}`);
				} else {
					assert.match(lines.join('\n'), expected, `, the slice of ${JSON.stringify(input)} is:\n${code}`);
				}
			});
		}
	});
}

/** Options for {@link assertDiced}. At least one field should be set. */
export interface DiceTestExpect {
	/** Exact reconstructed code expected (trimmed) */
	code?:       string
	/** Strings that must appear in the reconstructed output */
	contains?:   string[]
	/** Strings that must NOT appear in the reconstructed output */
	excludes?:   string[]
	/** Lower bound on the number of nodes in the dice result */
	minSize?:    number
	/** Upper bound on the number of nodes (0 = empty result) */
	maxSize?:    number
	/** Slicing criteria whose resolved ids must be present in the result */
	hasNodes?:   SlicingCriteria
	/** Slicing criteria whose resolved ids must be absent from the result */
	lacksNodes?: SlicingCriteria
}

/**
 * Assert the result of program dicing from `from` to `to` using {@link staticDice}.
 * When `expect` is a plain string it is treated as the exact reconstructed code.
 */
export function assertDiced(
	name: string | TestLabel,
	shell: KnownParser,
	input: string,
	from: SlicingCriteria,
	to: SlicingCriteria,
	expect: string | DiceTestExpect,
	userConfig?: Partial<TestConfiguration>
): void {
	const effectiveName = typeof name === 'string' ? name : decorateLabelContext(name, ['slice']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig))(`[dice] ${effectiveName}`, async function() {
		const { staticDice } = await import('../../../src/slicing/static/static-slicer');
		const { reconstructToCode } = await import('../../../src/reconstruct/reconstruct');
		const { doNotAutoSelect } = await import('../../../src/reconstruct/auto-select/auto-select-defaults');
		const analyzer = await new FlowrAnalyzerBuilder().setParser(shell).build();
		analyzer.addRequest(input);
		const ast  = await analyzer.normalize();
		const df   = await analyzer.dataflow();
		const startIds = SlicingCriterion.convertAll(from, ast.idMap);
		const endIds   = SlicingCriterion.convertAll(to, ast.idMap);
		const slice    = staticDice(analyzer.inspectContext(), df, ast, startIds, endIds);
		const rec      = reconstructToCode(ast, { nodes: slice.result }, doNotAutoSelect);
		const code     = (Array.isArray(rec.code) ? rec.code.join('\n') : rec.code).trim();

		const opts: DiceTestExpect = typeof expect === 'string' ? { code: expect } : expect;

		if(opts.code !== undefined) {
			assert.strictEqual(code, opts.code,
				`dice [${from.join(',')} -> ${to.join(',')}]: expected\n${opts.code}\ngot\n${code}\nfor input:\n${input}`
			);
		}
		for(const s of opts.contains ?? []) {
			assert.include(code, s, `dice result must contain "${s}"`);
		}
		for(const s of opts.excludes ?? []) {
			assert.notInclude(code, s, `dice result must NOT contain "${s}"`);
		}
		if(opts.minSize !== undefined) {
			assert.isAtLeast(slice.result.size, opts.minSize, 'result set must be at least this large');
		}
		if(opts.maxSize !== undefined) {
			assert.isAtMost(slice.result.size, opts.maxSize, 'result set must be at most this large');
		}
		for(const id of SlicingCriterion.convertAll(opts.hasNodes ?? [], ast.idMap)) {
			assert.isTrue(slice.result.has(id), `expected node id ${id} to be in dice result`);
		}
		for(const id of SlicingCriterion.convertAll(opts.lacksNodes ?? [], ast.idMap)) {
			assert.isFalse(slice.result.has(id), `expected node id ${id} NOT to be in dice result`);
		}
	});
}
