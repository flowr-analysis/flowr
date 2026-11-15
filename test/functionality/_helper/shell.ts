import { deepMergeObject, type MergeableRecord } from '../../../src/util/objects';
import { reconstructToCode } from '../../../src/reconstruct/reconstruct';
import { staticDice } from '../../../src/slicing/static/static-slicer';
import { guard } from '../../../src/util/assert';
import { decorateLabelContext, dropTestLabel, modifyLabelName, type TestLabel, type TestLabelContext } from './label';
import { printAsBuilder } from './dataflow/dataflow-builder-printer';
import { RShell } from '../../../src/r-bridge/shell';
import type { NoInfo, RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import { type fileProtocol, type RParseRequests, requestFromInput } from '../../../src/r-bridge/retriever';
import { minRVersionOf } from '../../../src/r-bridge/lang-4.x/ast/model/syntax-version';
import { MIN_VERSION_PIPE_PLACEHOLDER_EXTRACT } from '../../../src/r-bridge/lang-4.x/ast/model/versions';
import { normalizeTreeSitterTreeToAst } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-normalize';
import {
	type AstIdMap,
	deterministicCountingIdGenerator,
	type IdGenerator,
	type NormalizedAst,
	type ParentInformation,
	type RNodeWithParent
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../src/dataflow/graph/graph';
import { diffGraphsToMermaidUrl } from '../../../src/util/mermaid/dfg';
import {
	type SlicingCriteria,
	SlicingCriterion
} from '../../../src/slicing/criterion/parse';
import { normalizedAstToMermaidUrl } from '../../../src/util/mermaid/ast';
import type { AutoSelectPredicate } from '../../../src/reconstruct/auto-select/auto-select-defaults';
import { afterAll, assert, beforeAll, describe, expect, test } from 'vitest';
import semver from 'semver/preload';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { GraphDifferenceReport, ProblematicDiffInfo } from '../../../src/util/diff-graph';
import { extractCfg } from '../../../src/control-flow/control-flow-graph';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { assertCfgSatisfiesProperties, type CfgProperty } from '../../../src/control-flow/cfg-properties';
import { FlowrConfig } from '../../../src/config';
import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../../src/project/flowr-analyzer';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { analyze, joinedCode, type SliceTestResult, type SliceOptions, staticSliceOf } from './analyzer';
import type { RProject } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import { SliceDirection } from '../../../src/util/slice-direction';
import { CallGraph } from '../../../src/dataflow/graph/call-graph';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { EdgeType } from '../../../src/dataflow/graph/edge';
import { uniqueArray } from '../../../src/util/collections/arrays';

/** Runs the given test with a shell. */
export const testWithShell = (msg: string, fn: (shell: RShell, test: unknown) => void | Promise<void>, timeout?: number) => test(msg, async function(this: unknown): Promise<void> {
	let shell: RShell | null = null;
	try {
		shell = new RShell();
		await fn(shell, this);
	} finally {
		// ensure we close the shell in error cases too
		shell?.close();
	}
}, timeout);

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
	return JSON.parse(JSON.stringify(obj, (key, value: unknown) => {
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
		return value;
	})) as T;
}

function assertAstEqual<Info>(ast: RProject<Info> | RNode<Info>, expected: RProject<Info> | RNode<Info>, includeTokens: boolean, ignoreColumns: boolean, message?: () => string, ignoreMiscSourceInfo = true): void {
	ast = removeInformation(ast, includeTokens, ignoreColumns, ignoreMiscSourceInfo);
	// eslint-disable-next-line flowr/replacement-pattern -- `expected` may be a project, which `RExpressionList.is` does not accept, and `RProject` has no `is`
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

/** The normalized AST of the given input, as the {@link FlowrAnalyzer} produces it. */
export const retrieveNormalizedAst = async(parser: KnownParser, input: `${typeof fileProtocol}${string}` | string): Promise<NormalizedAst> => (await analyze(parser, input)).normalize();

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

const defaultTestConfiguration: TestConfiguration = {
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

/** Automatically skip a test whose `code` uses syntax the R at hand cannot parse, even if the test does not state its {@link TestConfiguration.minRVersion} */
function skipTestBecauseSyntaxTooNew(code: string): boolean {
	if(globalThis.rVersion && semver.gte(globalThis.rVersion, MIN_VERSION_PIPE_PLACEHOLDER_EXTRACT)) {
		return false;
	}
	const ts = new TreeSitterExecutor();
	let needed: semver.SemVer | undefined;
	try {
		const parsed = ts.parse(requestFromInput(code), contextFromInput(code));
		needed = minRVersionOf(normalizeTreeSitterTreeToAst([{ parsed, filePath: undefined }], true).files.map(f => f.root));
	} catch{
		/* code tree-sitter cannot read either is left to the test */
	} finally {
		ts.close();
	}
	return needed !== undefined && skipTestBecauseInsufficientRVersion(`>=${needed.version}`);
}

/** Automatically skip a test if the given configuration is not met, or if the R at hand cannot parse its `code` */
export function skipTestBecauseConfigNotMet(userConfig?: Partial<TestConfiguration>, code?: string): boolean {
	const config = deepMergeObject(defaultTestConfiguration, userConfig);
	return config.needsNetworkConnection && skipTestBecauseNoNetwork()
		|| config.minRVersion !== undefined && skipTestBecauseInsufficientRVersion(`>=${config.minRVersion}`)
		|| code !== undefined && skipTestBecauseSyntaxTooNew(code);
}

/**
 * For a given input code, this takes multiple ASTs depending on the respective normalizer step to run!
 */
export function assertAst(name: TestLabel | string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration & {
	ignoreAdToks:   boolean,
	ignoreColumns:  boolean,
	skipTreeSitter: boolean
}>) {
	const skip = skipTestBecauseConfigNotMet(userConfig, input);
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
			return (await retrieveNormalizedAst(shell, input)).ast;
		}

		async function makeTsAst(): Promise<RProject> {
			return (await retrieveNormalizedAst(ts as TreeSitterExecutor, input)).ast;
		}
	});
}

/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	test.skipIf(skipTestBecauseConfigNotMet(userConfig, input))(name, async function() {
		const { ast } = await (await analyze(shell, input, { getId: deterministicCountingIdGenerator(startIndexForDeterministicIds) })).normalize();

		assertAstEqual(ast, expected, false, false, () => `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`);
	});
}

/** Maps problematic nodes in a diff report to their ids for easier marking in mermaid graphs */
export function mapProblematicNodesToIds(problematic: readonly ProblematicDiffInfo[] | undefined): Set<NodeId> | undefined {
	return problematic === undefined ? undefined : new Set(problematic.map(p => p.tag === 'vertex' ? String(p.id) : `${p.from}->${p.to}`));
}

/** Assert that the given input code produces the expected output in R. Trims by default. */
function assertOutput(name: string | TestLabel, parser: KnownParser, input: string | RParseRequests, expected: string | RegExp, userConfig?: Partial<TestConfigurationWithOutput>): void {
	if(typeof input !== 'string') {
		throw new Error('Currently, we have no support for expecting the output of arbitrary requests');
	}
	const effectiveName = decorateLabelContext(name, ['output']);
	test.skipIf(skipTestBecauseConfigNotMet(userConfig, typeof input === 'string' ? input : undefined))(`${effectiveName} (input: ${input})`, async function() {
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
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- a modifier that works in place returns nothing
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
	test.skipIf(skipTestBecauseConfigNotMet(userConfig, parser instanceof RShell && typeof input === 'string' ? input : undefined))(`${effectiveName} (input: ${cropIfTooLong(JSON.stringify(input))})`, async function() {
		let analyzer = await analyze(parser, input, {
			config,
			assumeLoaded: assumed,
			getId:        deterministicCountingIdGenerator(startIndexForDeterministicIds),
			files:        userConfig?.addFiles
		});

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
			const resolve = (id: NodeId): NodeId => userConfig?.resolveIdsAsCriterion ? SlicingCriterion.tryParse(id, normalize.idMap) ?? id : id;
			for(const id of userConfig?.mustNotHaveVertices ?? []) {
				guard(!graph.hasVertex(resolve(id)), () => `Graph must not have vertex ${id}, but it exists.`);
			}
			for(const [from, to] of userConfig?.mustNotHaveEdges ?? []) {
				guard(!graph.outgoingEdges(resolve(from))?.has(resolve(to)), () => `Graph must not have edge ${from} -> ${to}, but it exists.`);
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
	test.skipIf(skipTestBecauseConfigNotMet(userConfig, input))(decorateLabelContext(name, ['slice']), async function(this: unknown) {
		const normalize = await (await analyze(shell, input, { getId })).normalize();
		const reconstructed = reconstructToCode(normalize, { nodes: new Set(selectedIds) });
		assert.strictEqual(reconstructed.code, expected,
			`got: ${reconstructed.code as string}, vs. expected: ${expected}, for input ${input} (ids ${JSON.stringify(ids)}:\n${[...normalize.idMap].map(i => `${i[0]}: '${i[1].lexeme}'`).join('\n')})`);
	});
	handleAssertOutput(name, shell, input, userConfig);
}

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
	/** Whether to skip the shell/Tree-sitter AST comparison (only relevant when the divergence is a known issue) */
	skipCompare:          boolean,
	/** Which CFG properties to exclude for CFG checks */
	cfgExcludeProperties: readonly CfgProperty[],
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
	const skip = skipTestBecauseConfigNotMet(testConfig, input);
	if(skip) {
		// drop it again because the test is not to be counted
		dropTestLabel(name);
	}
	const skipTreeSitter = testConfig?.skipTreeSitter === true;
	describe.skipIf(skip)(fullname, () => {
		const ts = skipTreeSitter ? undefined : new TreeSitterExecutor();
		let shellResult: SliceTestResult | undefined;
		let tsResult: SliceTestResult | undefined;
		const getId = testConfig?.getId ?? (() => deterministicCountingIdGenerator(0));
		beforeAll(async() => {
			const config = FlowrConfig.clone(testConfig?.flowrConfig ?? FlowrConfig.default());
			if(testConfig?.extendSlice) {
				FlowrConfig.setInConfigInPlace(config, 'solver.slicer.autoExtend', true);
			}
			const options: SliceOptions = {
				config,
				assumeLoaded:   assumed,
				files:          testConfig?.addFiles,
				direction:      testConfig?.sliceDirection,
				includeCallees: testConfig?.includeCallees,
				autoSelectIf:   testConfig?.autoSelectIf
			};
			shellResult = await staticSliceOf(shell, input, criteria, { ...options, getId: getId() });
			if(ts) {
				tsResult = await staticSliceOf(ts, input, criteria, { ...options, getId: getId() });
			}
		});
		afterAll(() => ts?.close());

		test('shell', () => testSlice(shellResult as SliceTestResult));
		test.skipIf(skipTreeSitter)('tree-sitter', () => testSlice(tsResult as SliceTestResult));
		test.skipIf(skipTreeSitter || testConfig?.skipCompare === true)('compare ASTs', () => {
			const tsAst = tsResult?.normalize.ast as RProject<ParentInformation>;
			const shellAst = shellResult?.normalize.ast as RProject<ParentInformation>;
			assertAstEqual(
				tsAst, shellAst, true, true,
				() => `tree-sitter ast: ${JSON.stringify(tsAst)} (${normalizedAstToMermaidUrl(tsAst)}), vs. shell ast: ${JSON.stringify(shellAst)} (${normalizedAstToMermaidUrl(shellAst)})`,
				false
			);
		});
		test.skipIf(skipTreeSitter)('cfg SAT properties', () => {
			const res = tsResult as SliceTestResult;
			const cfg = extractCfg(res.dataflow);
			const check = assertCfgSatisfiesProperties(cfg, testConfig?.cfgExcludeProperties);
			try {
				assert.isTrue(check, 'cfg fails properties: ' + check + ' is not satisfied');
			} catch(e: unknown) {
				console.error('cfg properties:', cfgToMermaidUrl(cfg, res.normalize));
				throw e;
			}
		});

		handleAssertOutput(name, shell, input, testConfig);

		function testSlice({ normalize, dataflow, slice, reconstruct }: SliceTestResult) {
			const context = `for input ${input} (slice for ${JSON.stringify(criteria)}: ${printIdMapping(slice.slicedFor, normalize.idMap)}), url: ${Dataflow.visualize.mermaid.url(dataflow.graph, true, slice.result)}`;
			if(Array.isArray(expected)) {
				const decodedExpected = expected.map(e => NodeId.normalize(SlicingCriterion.parse(e, normalize.idMap))).sort(NodeId.compare);
				const inSlice = Array.from(slice.result, NodeId.normalize).sort(NodeId.compare);
				assert.deepStrictEqual(inSlice, decodedExpected, `expected ids ${JSON.stringify(decodedExpected)} are not the slice ${JSON.stringify(inSlice)}, ${context}`);
			} else {
				assert.strictEqual(reconstruct.code, expected, `got:\n${joinedCode(reconstruct)}\nvs. expected:\n${expected}\n${context}`);
			}
			assert.strictEqual(slice.timesHitThreshold, 0, 'the slice shall not hit the threshold');
		}
		/* running the slice catches both a slice that drops what the criterion needs and one that does not parse */
		if(testConfig?.expectedSliceOutput !== undefined) {
			test('slice output', async() => {
				const code = joinedCode((shellResult as SliceTestResult).reconstruct);
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
	code?:         string
	/** Strings that must appear in the reconstructed output */
	contains?:     string[]
	/** Strings that must NOT appear in the reconstructed output */
	excludes?:     string[]
	/** Lower bound on the number of nodes in the dice result */
	minSize?:      number
	/** Upper bound on the number of nodes (0 = empty result) */
	maxSize?:      number
	/** Slicing criteria whose resolved ids must be present in the result */
	keptNodes?:    SlicingCriteria
	/** Slicing criteria whose resolved ids the result must not hold */
	droppedNodes?: SlicingCriteria
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
	test.skipIf(skipTestBecauseConfigNotMet(userConfig, input))(`[dice] ${effectiveName}`, async function() {
		const analyzer = await analyze(shell, input);
		const ast  = await analyzer.normalize();
		const df   = await analyzer.dataflow();
		const startIds = SlicingCriterion.convertAll(from, ast.idMap);
		const endIds   = SlicingCriterion.convertAll(to, ast.idMap);
		const slice    = staticDice(analyzer.inspectContext(), df, ast, startIds, endIds);
		const code     = joinedCode(reconstructToCode(ast, { nodes: slice.result })).trim();

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
		for(const id of SlicingCriterion.convertAll(opts.keptNodes ?? [], ast.idMap)) {
			assert.isTrue(slice.result.has(id), `expected node id ${id} to be in dice result`);
		}
		for(const id of SlicingCriterion.convertAll(opts.droppedNodes ?? [], ast.idMap)) {
			assert.isFalse(slice.result.has(id), `expected node id ${id} NOT to be in dice result`);
		}
	});
}

/** the code the static-slice query of a fresh analyzer reconstructs for `criterion` */
export async function sliceOf(parser: KnownParser, code: string, criterion: SlicingCriterion): Promise<string> {
	const analyzer = await analyze(parser, code);
	const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
	return (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
}

/** asserts that the slice for `criterion` keeps each of `has` and none of `lacks` */
export function assertSliceKeeps(name: string, parser: KnownParser, code: string, criterion: SlicingCriterion, { kept = [], dropped = [] }: { kept?: readonly string[], dropped?: readonly string[] }) {
	test(name, async() => {
		const sliced = await sliceOf(parser, code, criterion);
		for(const s of kept) {
			assert.include(sliced, s, `slice should keep ${s}:\n${sliced}`);
		}
		for(const s of dropped) {
			assert.notInclude(sliced, s, `slice should drop ${s}:\n${sliced}`);
		}
	});
}

/** asserts which of the given definitions the call at `criterion` reaches with a calls edge */
export function assertCallTargets(name: string, parser: KnownParser, code: string, criterion: SlicingCriterion, { reaches = [], misses = [] }: { reaches?: readonly SlicingCriterion[], misses?: readonly SlicingCriterion[] }) {
	test(name, async() => {
		const analyzer = await analyze(parser, code);
		const { idMap } = await analyzer.normalize();
		const targets = new Set(Dataflow.targetsOf((await analyzer.dataflow()).graph, SlicingCriterion.parse(criterion, idMap), EdgeType.Calls));
		for(const r of reaches) {
			assert.isTrue(targets.has(SlicingCriterion.parse(r, idMap)), `${criterion} should call ${r}`);
		}
		for(const r of misses) {
			assert.isFalse(targets.has(SlicingCriterion.parse(r, idMap)), `${criterion} should not call ${r}`);
		}
	});
}

/** asserts that the slice for `criterion`, run by {@link printedByR}, prints `lastLine` last, as the whole program does */
export function assertSliceRunsInR(name: string, parser: KnownParser, code: string, criterion: SlicingCriterion, lastLine: string, config?: Partial<TestConfiguration>) {
	test.skipIf(skipTestBecauseConfigNotMet(config, code))(name, async({ skip }) => {
		const slice = await sliceOf(parser, code, criterion);
		/* the program goes first, as a failing slice must not hide that an old R cannot run the program either */
		const running = printedByR(slice);
		running.catch(() => undefined);
		const program = await printedByProgram(code, skip);
		const sliced = await running;
		assert.strictEqual(program.split('\n').at(-1), lastLine, 'the program itself');
		assert.strictEqual(sliced.split('\n').at(-1), lastLine, `the slice:\n${slice}`);
	});
}

const execFileAsync = promisify(execFile);

/* each test file runs its tests concurrently, so without a bound every worker starts an R for each of them at once, which runs out of memory */
const MaxRunningR = 2;
let runningR = 0;
const waitingForR: (() => void)[] = [];

async function withRSlot<T>(this: void, run: () => Promise<T>): Promise<T> {
	if(runningR >= MaxRunningR) {
		await new Promise<void>(resolve => waitingForR.push(resolve));
	}
	runningR++;
	try {
		return await run();
	} finally {
		runningR--;
		waitingForR.shift()?.();
	}
}

/**
 * What `Rscript` prints for `code` in a fresh directory holding `files`, failing on an error or after 20 seconds.
 * The code goes through a file, as windows cuts `-e` at the first line break.
 * Use {@link printedByProgram} for the program of a test, as not every R can run it.
 */
export async function printedByR(code: string, files: Readonly<Record<string, string>> = {}): Promise<string> {
	const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'flowr-r-'));
	const cwd = path.join(root, 'work');
	const script = path.join(root, 'script.R');
	try {
		await fs.promises.mkdir(cwd);
		await fs.promises.writeFile(script, code);
		await Promise.all(Object.entries(files).map(([name, content]) => fs.promises.writeFile(path.join(cwd, name), content)));
		return await withRSlot(async() => {
			const running = execFileAsync('Rscript', ['--vanilla', script], { cwd, maxBuffer: 1 << 24 });
			/* not the `timeout` of execFile: when a blocked event loop (e.g., loading the signature database) runs it late, it drops the output of an R that finished long ago and reports success */
			const timer = setTimeout(() => running.child.kill('SIGKILL'), 20_000);
			try {
				return (await running).stdout.replace(/\r\n/g, '\n').trimEnd();
			} finally {
				clearTimeout(timer);
			}
		});
	} finally {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
}

/**
 * What the program `code` prints, skipping the test when this R lacks a package it loads (see {@link skipWithoutRPackages})
 * or when an R other than the one CI mainly tests (`ACTION_R_VERSION`) cannot run the program itself: base functions
 * differ between versions (e.g., `untar`), which says nothing about flowR. The main R, and any run without that
 * variable (e.g., locally), still fails.
 */
export async function printedByProgram(code: string, skip: (condition: boolean, note?: string) => void, files?: Readonly<Record<string, string>>): Promise<string> {
	await skipWithoutRPackages(code, skip);
	try {
		return await printedByR(code, files);
	} catch(e) {
		const main = process.env.ACTION_R_VERSION, version = globalThis.rVersion;
		if(main && version && !semver.eq(version, main)) {
			const reason = /^Error.*$/m.exec((e as { stderr?: string }).stderr ?? '')?.[0] ?? String(e);
			skip(true, `R ${version.raw} (CI mainly tests ${main}) cannot run the program itself: ${reason}`);
		}
		throw e;
	}
}

let ciRPackages: Promise<{ listed: readonly string[], available: ReadonlySet<string> }> | undefined;

/** skips a test whose `code` loads a package CI installs (`packages.txt`) but this R lacks, as CRAN no longer builds it for an old R */
export async function skipWithoutRPackages(code: string, skip: (condition: boolean, note?: string) => void): Promise<void> {
	const used = [...code.matchAll(/\b(?:library|require|requireNamespace|loadNamespace)\(\s*["']?([\w.]+)|\b([\w.]+):::?/g)].map(m => m[1] ?? m[2]);
	if(used.length === 0) {
		return;
	}
	ciRPackages ??= (async() => ({
		listed:    (await fs.promises.readFile('.github/actions/setup-r/packages.txt', 'utf-8')).split(/\s+/).filter(p => p.length > 0),
		available: new Set((await printedByR('cat(.packages(all.available = TRUE), sep = "\\n")')).split('\n'))
	}))();
	const { listed, available } = await ciRPackages;
	const missing = uniqueArray(used).filter(p => listed.includes(p) && !available.has(p));
	skip(missing.length > 0, `R ${globalThis.rVersion?.raw ?? '?'} lacks ${missing.join(', ')}`);
}

/**
 * Asserts that the slice for `criterion` (default: the call on the last line), run by `Rscript`, prints what the program
 * prints last (all of it with `whole`) and does not hold `dropped`; `sigdb` turns the shipped signature database on.
 */
export function assertSliceMatchesR(parser: KnownParser, name: string, code: string, { criterion, dropped, whole, sigdb }: { criterion?: SlicingCriterion, dropped?: string, whole?: boolean, sigdb?: boolean } = {}) {
	test.skipIf(skipTestBecauseConfigNotMet(undefined, code))(name, async({ skip }) => {
		const lines = code.split('\n');
		const disabled = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		if(sigdb) {
			delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		}
		const slice = await sliceOf(parser, code, criterion ?? `${lines.length}@${/^(\w+)\(/.exec(lines[lines.length - 1])?.[1] ?? 'print'}`).finally(() => {
			if(disabled !== undefined) {
				process.env.FLOWR_DISABLE_DEFAULT_SIGDB = disabled;
			}
		});
		const running = printedByR(slice);
		running.catch(() => undefined);
		const program = await printedByProgram(code, skip);
		const [all, part] = [program, await running].map(out => whole ? out : out.split('\n').at(-1));
		assert.strictEqual(part, all, `the slice:\n${slice}`);
		if(dropped !== undefined) {
			assert.notInclude(slice, dropped, `the slice:\n${slice}`);
		}
	});
}
