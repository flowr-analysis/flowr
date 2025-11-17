import { assert, beforeAll, test } from 'vitest';
import { hasDataFrameExpressionInfo, type AbstractInterpretationInfo, type DataFrameOperation } from '../../../../src/abstract-interpretation/data-frame/absint-info';
import type { AbstractDataFrameShape, DataFrameDomain, DataFrameShapeProperty } from '../../../../src/abstract-interpretation/data-frame/dataframe-domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from '../../../../src/abstract-interpretation/data-frame/semantics';
import { inferDataFrameShapes, resolveIdToDataFrameShape } from '../../../../src/abstract-interpretation/data-frame/shape-inference';
import type { AnyAbstractDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { type FlowrConfigOptions , defaultConfigOptions } from '../../../../src/config';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import { type DEFAULT_DATAFLOW_PIPELINE, type TREE_SITTER_DATAFLOW_PIPELINE , createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import type { RShell } from '../../../../src/r-bridge/shell';
import { type SingleSlicingCriterion , slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assertUnreachable, guard, isNotUndefined } from '../../../../src/util/assert';
import { getRangeEnd } from '../../../../src/util/range';
import { decorateLabelContext, type TestLabel } from '../../_helper/label';
import { type TestConfiguration , skipTestBecauseConfigNotMet } from '../../_helper/shell';
import {
	type FlowrAnalyzerContext,
	type ReadOnlyFlowrAnalyzerContext
	, contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../../../src/project/context/flowr-file';

/**
 * The default flowR configuration options for performing abstract interpretation.
 * As resolving eval calls from string is only supported in the data flow graph, we have to disable it when visiting the control flow graph to correctly identify eval statements as unknown side effects.
 */
const defaultAbsintConfig: FlowrConfigOptions = { ...defaultConfigOptions, solver: { ...defaultConfigOptions.solver, evalStrings: false } };

/**
 * Whether the inferred values should match the actual values exactly, or should be an over-approximation of the actual values.
 */
export enum DomainMatchingType {
    Exact = 'exact',
    Overapproximation = 'overapproximation'
}

/**
 * The data frame shape matching options defining which data frame shape property should match exactly, and which should be an over-approximation.
 */
export type DataFrameShapeMatching = Record<keyof AbstractDataFrameShape, DomainMatchingType>;

/**
 * Data frame shape matching options defining that every shape property should exactly match the actual value.
 */
export const DataFrameShapeExact: DataFrameShapeMatching = {
	colnames: DomainMatchingType.Exact,
	cols:     DomainMatchingType.Exact,
	rows:     DomainMatchingType.Exact
};

/**
 * Data frame shape matching options defining that every shape property should be an over-approximation of the actual value.
 */
export const DataFrameShapeOverapproximation: DataFrameShapeMatching = {
	colnames: DomainMatchingType.Overapproximation,
	cols:     DomainMatchingType.Overapproximation,
	rows:     DomainMatchingType.Overapproximation
};

/**
 * Data frame shape matching options defining that the inferred columns names should be an over-approximation of the actual value.
 */
export const ColNamesOverapproximation: Partial<DataFrameShapeMatching> = {
	colnames: DomainMatchingType.Overapproximation
};

/**
 * The expected data frame shape for data frame shape assertion tests.
 */
export interface ExpectedDataFrameShape {
	colnames: Exclude<DataFrameShapeProperty<'colnames'>, ReadonlySet<string>> | string[],
	cols:     DataFrameShapeProperty<'cols'>,
	rows:     DataFrameShapeProperty<'rows'>
}

type ExpectedDataFrameOperation = {
	[Name in DataFrameOperationName]: { operation: Name } & DataFrameOperationArgs<Name>
}[DataFrameOperationName];

/**
 * Stores the inferred data frame constraints and AST node for a tested slicing criterion.
 */
interface CriterionTestEntry {
	criterion:  SingleSlicingCriterion,
	inferred:   DataFrameDomain | undefined,
	node:       RSymbol<ParentInformation>,
	lineNumber: number,
	matching:   DataFrameShapeMatching
}

export interface DataFrameTestOptions extends Partial<TestConfiguration> {
	/** The parser to use for the data flow graph creation (defaults to the R shell) */
	readonly parser?:   KnownParser
	/** An optional name or test label for the test (defaults to the code) */
	readonly name?:     string | TestLabel
	/** Whether the real test with the execution of the R code should be skipped (defaults to `false`) */
	readonly skipRun?:  boolean | (() => boolean)
	/** Additional files to add to the flowR project context for the test */
	readonly addFiles?: FlowrFileProvider[]
}

/**
 * Combined test to assert the expected data frame shape constraints using {@link assertDataFrameDomain} and
 * to check the constraints against the real properties using {@link testDataFrameDomainAgainstReal} for given slicing criteria.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell       - The R shell to use to run the code
 * @param code        - The R code to test
 * @param criteria    - The slicing criteria to test including the expected shape constraints and a {@link DataFrameShapeMatching} option for each criterion (defaults to {@link DataFrameShapeExact})
 * @param config      - The test configuration options including the parser to use, the name for the test, and whether the execution test should be skipped ({@link DataFrameTestOptions})
 * @param flowRConfig - The flowR config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomain(
	shell: RShell,
	code: string,
	criteria: ([SingleSlicingCriterion, ExpectedDataFrameShape | undefined] | [SingleSlicingCriterion, ExpectedDataFrameShape | undefined, Partial<DataFrameShapeMatching>])[],
	config?: DataFrameTestOptions,
	flowRConfig: FlowrConfigOptions = defaultAbsintConfig
) {
	const { parser = shell, ...testConfig } = config ?? {};
	criteria = criteria.map(([criterion, expected, matching]) => [criterion, expected, getDefaultMatchingType(expected, matching)]);
	guardValidCriteria(criteria);
	assertDataFrameDomain(parser, code, criteria.map(entry => [entry[0], entry[1]]), testConfig, flowRConfig);
	testDataFrameDomainAgainstReal(shell, code, criteria.map(entry => entry.length === 3 ? [entry[0], entry[2]] : entry[0]), config, flowRConfig);
}

/**
 * Combined test for code reading data from external files with one run for the file argument using {@link assertDataFrameDomain} and
 * another run for the text argument using {@link testDataFrameDomain}.
 * This ensures that the code is only executed for the text argument.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell       - The R shell to use to run the code
 * @param fileArg     - The argument for the assert run
 * @param textArg     - The argument for the full test run where the code is executed
 * @param getCode     - The function to get the R code for `fileArg` or `textArg`
 * @param criteria    - The slicing criteria to test including the expected shape constraints and a {@link DataFrameShapeMatching} option for each criterion (defaults to {@link DataFrameShapeExact})
 * @param config      - The test configuration options including the parser to use, the name for the test, and whether the execution test should be skipped ({@link DataFrameTestOptions})
 * @param flowRConfig - The flowR config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomainWithSource(
	shell: RShell,
	fileArg: string, textArg: string,
	getCode: (arg: string) => string,
	criteria: ([SingleSlicingCriterion, ExpectedDataFrameShape] | [SingleSlicingCriterion, ExpectedDataFrameShape, Partial<DataFrameShapeMatching>])[],
	config?: DataFrameTestOptions,
	flowRConfig: FlowrConfigOptions = defaultAbsintConfig
) {
	const { parser = shell, ...testConfig } = config ?? {};
	criteria = criteria.map(([criterion, expected, matching]) => [criterion, expected, getDefaultMatchingType(expected, matching)]);
	guardValidCriteria(criteria);
	assertDataFrameDomain(parser, getCode(fileArg), criteria.map(entry => [entry[0], entry[1]]), testConfig, flowRConfig);
	testDataFrameDomain(shell, getCode(textArg), criteria, config, flowRConfig);
}

/**
 * Asserts inferred data frame shape constraints for given slicing criteria.
 * @param parser      - The parser to use for the data flow graph creation
 * @param code        - The R code to test
 * @param expected    - The expected data frame shape constraints for each slicing criterion
 * @param config      - The test configuration options including the parser to use, the name for the test, and whether the execution test should be skipped ({@link DataFrameTestOptions})
 * @param flowRConfig - The flowR config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function assertDataFrameDomain(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, ExpectedDataFrameShape | undefined][],
	config?: DataFrameTestOptions,
	flowRConfig: FlowrConfigOptions = defaultConfigOptions
) {
	const { name = code } = config ?? {};
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;
	let context: FlowrAnalyzerContext | undefined;

	beforeAll(async() => {
		if(!skipTestBecauseConfigNotMet(config)) {
			context = contextFromInput(code, flowRConfig);
			if(config?.addFiles) {
				context.addFiles(config.addFiles);
			}
			result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		}
	});

	test.skipIf(skipTestBecauseConfigNotMet(config)).each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const [inferred] = getInferredDomainForCriterion(result, criterion, context as ReadOnlyFlowrAnalyzerContext);
		assertDomainMatches(inferred, expect, DataFrameShapeExact);
	});
}

/**
 * Asserts an inferred abstract data frame operation for given slicing criteria.
 * @param parser      - The parser to use for the data flow graph creation
 * @param code        - The R code to test
 * @param expected    - The expected abstract data frame operation for each slicing criterion
 * @param config      - The test configuration options including the parser to use, the name for the test, and whether the execution test should be skipped ({@link DataFrameTestOptions})
 * @param flowRConfig - The flowR config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function assertDataFrameOperation(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, ExpectedDataFrameOperation[]][],
	config?: DataFrameTestOptions,
	flowRConfig: FlowrConfigOptions = defaultAbsintConfig
) {
	const { name = code } = config ?? {};
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;
	let context: FlowrAnalyzerContext | undefined;

	beforeAll(async() => {
		if(!skipTestBecauseConfigNotMet(config)) {
			context = contextFromInput(code, flowRConfig);
			result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		}
	});

	test.skipIf(skipTestBecauseConfigNotMet(config)).each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const operations = getInferredOperationsForCriterion(result, criterion, context as ReadOnlyFlowrAnalyzerContext);
		assert.containSubset(operations, expect, `expected ${JSON.stringify(operations)} to equal ${JSON.stringify(expect)}`);
	});
}

/**
 * Tests that the inferred data frame shape constraints at given slicing criteria match or over-approximate
 * the real shape properties of the slicing criteria by instrumenting the code.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell       - The R shell to use to run the instrumented code
 * @param code        - The R code to test
 * @param criteria    - The slicing criteria to test including a {@link DataFrameShapeMatching} option for each criterion (defaults to {@link DataFrameShapeExact})
 * @param config      - The test configuration options including the parser to use, the name for the test, and whether the execution test should be skipped ({@link DataFrameTestOptions})
 * @param flowRConfig - The flowR config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomainAgainstReal(
	shell: RShell,
	code: string,
	/** The matching options describe whether the inferred properties should match exactly the actual properties or can be an over-approximation (defaults to exact for all properties) */
	criteria: (SingleSlicingCriterion | [SingleSlicingCriterion, Partial<DataFrameShapeMatching>])[],
	config?: DataFrameTestOptions,
	flowRConfig: FlowrConfigOptions = defaultAbsintConfig
) {
	const { parser = shell, name = code, skipRun = false } = config ?? {};

	test.skipIf(skipTestBecauseConfigNotMet(config))(decorateLabelContext(name, ['absint']), async({ skip })=> {
		if(typeof skipRun === 'boolean' ? skipRun : skipRun()) {
			skip();
		}
		const context = contextFromInput(code, flowRConfig);
		const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
		const testEntries: CriterionTestEntry[] = [];

		for(const entry of criteria) {
			const criterion = Array.isArray(entry) ? entry[0] : entry;
			const matching = { ...DataFrameShapeExact, ...(Array.isArray(entry) ? entry[1] : {}) };
			const [inferred, node] = getInferredDomainForCriterion(result, criterion, context);

			if(node.type !== RType.Symbol) {
				throw new Error(`slicing criterion ${criterion} does not refer to an R symbol`);
			}
			const lineNumber = getRangeEnd(node.info.fullRange ?? node.location)?.[0];

			if(lineNumber === undefined) {
				throw new Error(`cannot resolve line of criterion ${criterion}`);
			}
			testEntries.push({ criterion, inferred, node, lineNumber, matching });
		}
		testEntries.sort((a, b) => b.lineNumber - a.lineNumber);
		const lines = code.split('\n');

		for(const { criterion, node, lineNumber } of testEntries) {
			const outputCode = createCodeForOutput(criterion, node.content);
			lines.splice(lineNumber, 0, outputCode);
		}
		shell.clearEnvironment();
		const instrumentedCode = lines.join('\n');
		const output = await shell.sendCommandWithOutput(instrumentedCode);

		for(const { criterion, inferred, matching } of testEntries) {
			const expected = getRealDomainFromOutput(criterion, output);
			assertDomainMatches(inferred, expected, matching);
		}
	});
}

function assertDomainMatches(
	inferred: DataFrameDomain | undefined,
	expected: ExpectedDataFrameShape | undefined,
	matching: DataFrameShapeMatching
): void {
	if(Object.values(matching).some(type => type === DomainMatchingType.Exact)) {
		assert.ok(inferred === expected || (inferred !== undefined && expected !== undefined), `result differs: expected ${inferred?.toString()} to equal ${JSON.stringify(expected)}`);
	} else {
		assert.ok(inferred === undefined || expected !== undefined, `result is no over-approximation: expected ${inferred?.toString()} to be an over-approximation of ${JSON.stringify(expected)}`);
	}
	if(inferred !== undefined && expected !== undefined) {
		assertPropertyMatches('colnames', inferred.colnames, inferred.colnames.create(expected.colnames), matching.colnames);
		assertPropertyMatches('cols', inferred.cols, inferred.cols.create(expected.cols), matching.cols);
		assertPropertyMatches('rows', inferred.rows, inferred.rows.create(expected.rows), matching.rows);
	}
}

function assertPropertyMatches<K extends keyof AbstractDataFrameShape, T extends AnyAbstractDomain>(
	type: K,
	inferred: T,
	expected: T,
	matching: DomainMatchingType
): void {
	switch(matching) {
		case DomainMatchingType.Exact:
			return assert.ok(inferred.equals(expected), `${type} differs: expected ${inferred.toString()} to equal ${expected.toString()}`);
		case DomainMatchingType.Overapproximation:
			return assert.ok(expected.leq(inferred), `${type} is no over-approximation: expected ${inferred.toString()} to be an over-approximation of ${expected.toString()}`);
		default:
			assertUnreachable(matching);
	}
}

function createCodeForOutput(
	criterion: SingleSlicingCriterion,
	symbol: string
): string {
	const marker = getOutputMarker(criterion);
	return `cat(sprintf("${marker} %s,%s,%s,%s\\n", is.data.frame(${symbol}), paste(names(${symbol}), collapse = ";"), paste(ncol(${symbol}), collapse = ""), paste(nrow(${symbol}), collapse = "")))`;
}

function getDefaultMatchingType(expected: ExpectedDataFrameShape | undefined, matching?: Partial<DataFrameShapeMatching>): Partial<DataFrameShapeMatching> {
	const matchingType: Partial<DataFrameShapeMatching> = { ...matching };

	if(expected !== undefined) {
		if(matching?.colnames === undefined && expected.colnames === Top) {
			matchingType.colnames = DomainMatchingType.Overapproximation;
		}
		if(matching?.cols === undefined) {
			if(expected.cols === Bottom || expected.cols[0] === expected.cols[1]) {
				matchingType.cols = DomainMatchingType.Exact;
			} else {
				matchingType.cols = DomainMatchingType.Overapproximation;
			}
		}
		if(matching?.rows === undefined) {
			if(expected.rows === Bottom || expected.rows[0] === expected.rows[1]) {
				matchingType.rows = DomainMatchingType.Exact;
			} else {
				matchingType.rows = DomainMatchingType.Overapproximation;
			}
		}
	}
	return matchingType;
}

function getInferredDomainForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion,
	ctx: ReadOnlyFlowrAnalyzerContext
): [DataFrameDomain | undefined, RNode<ParentInformation>] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, ctx, result.dataflow.graph);
	inferDataFrameShapes(cfg, result.dataflow.graph, result.normalize, ctx);
	const value = resolveIdToDataFrameShape(node, result.dataflow.graph);

	return [value, node];
}

function getInferredOperationsForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion,
	ctx: ReadOnlyFlowrAnalyzerContext
): DataFrameOperation[] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, ctx, result.dataflow.graph);
	inferDataFrameShapes(cfg, result.dataflow.graph, result.normalize, ctx);

	return hasDataFrameExpressionInfo(node) ? node.info.dataFrame.operations : [];
}

function getRealDomainFromOutput(
	criterion: SingleSlicingCriterion,
	output: string[]
): ExpectedDataFrameShape | undefined {
	const marker = getOutputMarker(criterion);
	const line = output.find(line => line.startsWith(marker))?.replace(marker, '').trim();

	if(line === undefined) {
		throw new Error(`cannot parse output of instrumented code for ${criterion}`);
	}
	const OutputRegex = /^(TRUE|FALSE),(.*),(\w*),(\w*)$/;
	const result = line.match(OutputRegex);

	if(result?.length === 5) {
		const dataFrame = result[1] === 'TRUE';
		const colnames = result[2].length > 0 ? result[2].split(';') : [];
		const cols = Number.parseInt(result[3]);
		const rows = Number.parseInt(result[4]);

		return dataFrame ? { colnames: colnames, cols: [cols, cols], rows: [rows, rows] } : undefined;
	}
	return undefined;
}

function getOutputMarker(criterion: SingleSlicingCriterion): string {
	return `SHAPE INFERENCE ${criterion}:`;
}

function guardValidCriteria(
	criteria: ([SingleSlicingCriterion, ExpectedDataFrameShape | undefined] | [SingleSlicingCriterion, ExpectedDataFrameShape | undefined, Partial<DataFrameShapeMatching>])[]
): void {
	for(const [criterion, domain, matching] of criteria) {
		if(domain !== undefined) {
			if(domain.colnames === Top) {
				guard(matching?.colnames === DomainMatchingType.Overapproximation, `Domain matching type for column names of "${criterion}" must be \`Overapproximation\` if expected column names are ${domain.colnames.toString()}`);
			}
			if(domain.cols !== Bottom && domain.cols[0] !== domain.cols[1]) {
				guard(matching?.cols === DomainMatchingType.Overapproximation, `Domain matching type for number of columns of "${criterion}" must be \`Overapproximation\` if expected interval has more than 1 element ${domain.cols.toString()}`);
			} else {
				guard((matching?.cols ?? DomainMatchingType.Exact) === DomainMatchingType.Exact, `Domain matching type for number of columns of "${criterion}" must be \`Exact\` if expected interval has only 1 element ${domain.cols.toString()}`);
			}
			if(domain.rows !== Bottom && domain.rows[0] !== domain.rows[1]) {
				guard(matching?.rows === DomainMatchingType.Overapproximation, `Domain matching type for number of rows of "${criterion}" must be \`Overapproximation\` if expected interval has more than 1 element ${domain.rows.toString()}`);
			} else {
				guard((matching?.rows ?? DomainMatchingType.Exact) === DomainMatchingType.Exact, `Domain matching type for number of rows of "${criterion}" must be \`Exact\` if expected interval has only 1 element ${domain.rows.toString()}`);
			}
		}
	}
}
