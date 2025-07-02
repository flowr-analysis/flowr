import { assert, beforeAll, test } from 'vitest';
import type { AbstractInterpretationInfo, DataFrameOperations } from '../../../../src/abstract-interpretation/data-frame/absint-info';
import { performDataFrameAbsint, resolveIdToAbstractValue } from '../../../../src/abstract-interpretation/data-frame/absint-visitor';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesTop, equalColNames, equalInterval, IntervalBottom, leqColNames, leqInterval } from '../../../../src/abstract-interpretation/data-frame/domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from '../../../../src/abstract-interpretation/data-frame/semantics';
import type { FlowrConfigOptions } from '../../../../src/config';
import { defaultConfigOptions } from '../../../../src/config';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import type { DEFAULT_DATAFLOW_PIPELINE, TREE_SITTER_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { RShell } from '../../../../src/r-bridge/shell';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assertUnreachable, guard, isNotUndefined } from '../../../../src/util/assert';
import { getRangeEnd } from '../../../../src/util/range';
import { decorateLabelContext, type TestLabel } from '../../_helper/label';

export enum DomainMatchingType {
    Exact = 'exact',
    Overapproximation = 'overapproximation'
}

export type DataFrameTestOptions = Record<keyof DataFrameDomain, DomainMatchingType>;

export const DataFrameTestExact: DataFrameTestOptions = {
	colnames: DomainMatchingType.Exact,
	cols:     DomainMatchingType.Exact,
	rows:     DomainMatchingType.Exact
};

export const DataFrameTestOverapproximation: DataFrameTestOptions = {
	colnames: DomainMatchingType.Overapproximation,
	cols:     DomainMatchingType.Overapproximation,
	rows:     DomainMatchingType.Overapproximation
};

type DataFrameOperationType = {
	[Name in DataFrameOperationName]: { operation: Name } & DataFrameOperationArgs<Name>
}[DataFrameOperationName];

type DomainComparisonMapping = {
	[K in keyof DataFrameDomain]: {
		equal: (value1: DataFrameDomain[K], value2: DataFrameDomain[K]) => boolean,
		leq:   (value1: DataFrameDomain[K], value2: DataFrameDomain[K]) => boolean
	}
}

const ComparisonFunctions: DomainComparisonMapping = {
	colnames: { equal: equalColNames, leq: leqColNames },
	cols:     { equal: equalInterval, leq: leqInterval },
	rows:     { equal: equalInterval, leq: leqInterval }
};

/** Stores the inferred data frame constraints and AST node for a tested slicing criterion */
interface CriterionTestEntry {
	criterion:  SingleSlicingCriterion,
	inferred:   DataFrameDomain | undefined,
	node:       RSymbol<ParentInformation>,
	lineNumber: number,
	options:    DataFrameTestOptions
}

/**
 * Combined test to assert the expected data frame shape constraints using {@link assertDataFrameDomain} and
 * to check the constraints against the real properties using {@link testDataFrameDomainAgainstReal} for given slicing criteria.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 *
 * @param shell    - The R shell to use to run the code
 * @param code     - The code to test
 * @param criteria - The slicing criteria to test including the expected shape constraints and the {@link DataFrameTestOptions} for each criterion (defaults to {@link DataFrameTestExact})
 * @param skipRun  - Whether the real test with the execution of the R code should be skipped (defaults to `false`)
 * @param parser   - The parser to use for the data flow graph creation (defaults to the R shell)
 * @param name     - An optional name or test label for the test (defaults to the code)
 * @param config   - The config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomain(
	shell: RShell,
	code: string,
	criteria: ([SingleSlicingCriterion, DataFrameDomain | undefined] | [SingleSlicingCriterion, DataFrameDomain | undefined, Partial<DataFrameTestOptions>])[],
	skipRun: boolean | (() => boolean) = false,
	parser: KnownParser = shell,
	name: string | TestLabel = code,
	config: FlowrConfigOptions = defaultConfigOptions
) {
	guardValidCriteria(criteria);
	assertDataFrameDomain(parser, code, criteria.map(entry => [entry[0], entry[1]]), name, config);
	testDataFrameDomainAgainstReal(shell, code, criteria.map(entry => entry.length === 3 ? [entry[0], entry[2]] : entry[0]), skipRun, parser, name, config);
}

/**
 * Combined test for code reading data from external files with one run for the file argument using {@link assertDataFrameDomain} and
 * another run for the text argument using {@link testDataFrameDomain}.
 * This ensures that the code is only executed for the text argument.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 *
 * @param shell    - The R shell to use to run the code
 * @param fileArg  - The argument for the assert run
 * @param textArg  - The argument for the full test run where the code is executed
 * @param getCode  - The function to get the code for `fileArg` or `textArg`
 * @param criteria - The slicing criteria to test including the expected shape constraints and the {@link DataFrameTestOptions} for each criterion (defaults to {@link DataFrameTestExact})
 * @param skipRun  - Whether the real test with the execution of the R code should be skipped (defaults to `false`)
 * @param parser   - The parser to use for the data flow graph creation (defaults to the R shell)
 * @param name     - An optional name or test label for the test (defaults to the code)
 * @param config   - The config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomainWithSource(
	shell: RShell,
	fileArg: string, textArg: string,
	getCode: (arg: string) => string,
	criteria: ([SingleSlicingCriterion, DataFrameDomain] | [SingleSlicingCriterion, DataFrameDomain, Partial<DataFrameTestOptions>])[],
	skipRun: boolean | (() => boolean) = false,
	parser: KnownParser = shell,
	name?: string | TestLabel,
	config: FlowrConfigOptions = defaultConfigOptions
) {
	guardValidCriteria(criteria);
	assertDataFrameDomain(parser, getCode(fileArg), criteria.map(entry => [entry[0], entry[1]]), name ?? getCode(fileArg), config);
	testDataFrameDomain(shell, getCode(textArg), criteria, skipRun, parser, name ?? getCode(textArg), config);
}

/**
 * Asserts inferred data frame shape constraints for given slicing criteria.
 *
 * @param parser   - The parser to use for the data flow graph creation
 * @param code     - The code to test
 * @param expected - The expected data frame shape constraints for each slicing criterion
 * @param name     - An optional name or test label for the test (defaults to the code)
 * @param config   - The config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function assertDataFrameDomain(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameDomain | undefined][],
	name: string | TestLabel = code,
	config: FlowrConfigOptions = defaultConfigOptions
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }, config).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const [inferred] = getInferredDomainForCriterion(result, criterion, config);
		assertDomainMatches(inferred, expect, DataFrameTestExact);
	});
}

/**
 * Asserts an inferred abstract data frame operation for given slicing criteria.
 *
 * @param parser   - The parser to use for the data flow graph creation
 * @param code     - The code to test
 * @param expected - The expected abstract data frame operation for each slicing criterion
 * @param name     - An optional name or test label for the test (defaults to the code)
 * @param config   - The config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function assertDataFrameOperation(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameOperationType[]][],
	name: string | TestLabel = code,
	config: FlowrConfigOptions = defaultConfigOptions
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }, config).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const operations = getInferredOperationsForCriterion(result, criterion, config)
			.map(op => ({ operation: op.operation, ...op.args }));
		assert.deepStrictEqual(operations, expect, `expected ${JSON.stringify(operations)} to equal ${JSON.stringify(expect)}`);
	});
}

/**
 * Tests that the inferred data frame shape constraints at given slicing criteria match or over-approximate
 * the real shape properties of the slicing criteria by instrumentating the code.
 * Only slicing criteria for symbols are allowed (e.g. no function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 *
 * @param shell    - The R shell to use to run the instrumented code
 * @param code     - The code to test
 * @param criteria - The slicing criteria to test including the {@link DataFrameTestOptions} for each criterion (defaults to {@link DataFrameTestExact})
 * @param skipRun  - Whether the test should be skipped (defaults to `false`)
 * @param parser   - The parser to use for the data flow graph creation (defaults to the R shell)
 * @param name     - An optional name or test label for the test (defaults to the code)
 * @param config   - The config to use for the test (defaults to {@link defaultConfigOptions})
 */
export function testDataFrameDomainAgainstReal(
	shell: RShell,
	code: string,
	/** The options describe whether the inferred properties should match exacly the actual properties or can be an over-approximation (defaults to exact for all properties) */
	criteria: (SingleSlicingCriterion | [SingleSlicingCriterion, Partial<DataFrameTestOptions>])[],
	skipRun: boolean | (() => boolean) = false,
	parser: KnownParser = shell,
	name: string | TestLabel = code,
	config: FlowrConfigOptions = defaultConfigOptions
) {
	test(decorateLabelContext(name, ['absint']), async({ skip })=> {
		if(typeof skipRun === 'boolean' ? skipRun : skipRun()) {
			skip();
		}
		const result = await createDataflowPipeline(parser, { request: requestFromInput(code) }, config).allRemainingSteps();
		const testEntries: CriterionTestEntry[] = [];

		for(const entry of criteria) {
			const criterion = Array.isArray(entry) ? entry[0] : entry;
			const options = { ...DataFrameTestExact, ...(Array.isArray(entry) ? entry[1] : {}) };
			const [inferred, node] = getInferredDomainForCriterion(result, criterion, config);

			if(node.type !== RType.Symbol) {
				throw new Error(`slicing criterion ${criterion} does not refer to a R symbol`);
			}
			const lineNumber = getRangeEnd(node.info.fullRange ?? node.location)?.[0];

			if(lineNumber === undefined) {
				throw new Error(`cannot resolve line of criterion ${criterion}`);
			}
			testEntries.push({ criterion, inferred, node, lineNumber, options });
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

		for(const { criterion, inferred, options } of testEntries) {
			const expected = getRealDomainFromOutput(criterion, output);
			assertDomainMatches(inferred, expected, options);
		}
	});
}

function assertDomainMatches(
	inferred: DataFrameDomain | undefined,
	expected: DataFrameDomain | undefined,
	options: DataFrameTestOptions
): void {
	if(Object.values(options).some(type => type === DomainMatchingType.Exact)) {
		assert.ok(inferred === expected || (inferred !== undefined && expected !== undefined), `result differs: expected ${JSON.stringify(inferred)} to equal ${JSON.stringify(expected)}`);
	} else {
		assert.ok(inferred === undefined || expected !== undefined, `result is no over-approximation: : expected ${JSON.stringify(inferred)} to be an over-approximation of ${JSON.stringify(expected)}`);
	}
	if(inferred !== undefined && expected !== undefined) {
		assertPropertyMatches('colnames', inferred.colnames, expected.colnames, options.colnames);
		assertPropertyMatches('cols', inferred.cols, expected.cols, options.cols);
		assertPropertyMatches('rows', inferred.rows, expected.rows, options.rows);
	}
}

function assertPropertyMatches<K extends keyof DataFrameDomain, T extends DataFrameDomain[K]>(
	type: K,
	inferred: T,
	expected: T,
	matchingType: DomainMatchingType
): void {
	const equalFunction = ComparisonFunctions[type].equal;
	const leqFunction = ComparisonFunctions[type].leq;

	switch(matchingType) {
		case DomainMatchingType.Exact:
			return assert.ok(equalFunction(inferred, expected), `${type} differs: expected ${JSON.stringify(inferred)} to equal ${JSON.stringify(expected)}`);
		case DomainMatchingType.Overapproximation:
			return assert.ok(leqFunction(expected, inferred), `${type} is no over-approximation: expected ${JSON.stringify(inferred)} to be an over-approximation of ${JSON.stringify(expected)}`);
		default:
			assertUnreachable(matchingType);
	}
}

function createCodeForOutput(
	criterion: SingleSlicingCriterion,
	symbol: string
): string {
	const marker = getOutputMarker(criterion);
	return `cat(sprintf("${marker} %s,[%s],%s,%s\\n", is.data.frame(${symbol}), paste(names(${symbol}), collapse = ","), paste(ncol(${symbol}), collapse = ""), paste(nrow(${symbol}), collapse = "")))`;
}

function getInferredDomainForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion,
	config: FlowrConfigOptions
): [DataFrameDomain | undefined, RNode<ParentInformation>] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, config, result.dataflow.graph);
	performDataFrameAbsint(cfg, result.dataflow.graph, result.normalize);
	const value = resolveIdToAbstractValue(node, result.dataflow.graph);

	return [value, node];
}

function getInferredOperationsForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion,
	config: FlowrConfigOptions
): DataFrameOperations[] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, config, result.dataflow.graph);
	performDataFrameAbsint(cfg, result.dataflow.graph, result.normalize);

	return node.info.dataFrame?.type === 'expression' ? node.info.dataFrame.operations : [];
}

function getRealDomainFromOutput(
	criterion: SingleSlicingCriterion,
	output: string[]
): DataFrameDomain | undefined {
	const marker = getOutputMarker(criterion);
	const line = output.find(line => line.startsWith(marker))?.replace(marker, '').trim();

	if(line === undefined) {
		throw new Error(`cannot parse output of instrumented code for ${criterion}`);
	}
	const OutputRegex = /^(TRUE|FALSE),\[(.*)\],(\w*),(\w*)$/;
	const result = line.match(OutputRegex);

	if(result?.length === 5) {
		const dataFrame = result[1] === 'TRUE';
		const colnames = result[2].length > 0 ? result[2].split(',') : [];
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
	criteria: ([SingleSlicingCriterion, DataFrameDomain | undefined] | [SingleSlicingCriterion, DataFrameDomain | undefined, Partial<DataFrameTestOptions>])[]
): void {
	for(const [criterion, domain, options] of criteria) {
		if(domain !== undefined) {
			if(domain.colnames === ColNamesTop) {
				guard(options?.colnames === DomainMatchingType.Overapproximation, `Domain matching type for column names of "${criterion}" must be \`Overapproximation\` if expected column names are top`);
			} else if(domain.cols !== IntervalBottom && domain.cols[0] !== domain.cols[1]) {
				guard(options?.cols === DomainMatchingType.Overapproximation, `Domain matching type for number of columns of "${criterion}" must be \`Overapproximation\` if expected interval has more than 1 element`);
			} else if(domain.rows !== IntervalBottom && domain.rows[0] !== domain.rows[1]) {
				guard(options?.rows === DomainMatchingType.Overapproximation, `Domain matching type for number of rows of "${criterion}" must be \`Overapproximation\` if expected interval has more than 1 element`);
			} else {
				guard(options?.cols === undefined || options.cols === DomainMatchingType.Exact, `Domain matching type for number of columns of "${criterion}" must be \`Exact\` if expected interval has only 1 element`);
				guard(options?.rows === undefined || options.rows === DomainMatchingType.Exact, `Domain matching type for number of rows of "${criterion}" must be \`Exact\` if expected interval has only 1 element`);
			}
		}
	}
}
