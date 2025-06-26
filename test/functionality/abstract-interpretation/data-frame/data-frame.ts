import { assert, beforeAll, test } from 'vitest';
import type { AbstractInterpretationInfo, DataFrameOperation, DataFrameOperations } from '../../../../src/abstract-interpretation/data-frame/absint-info';
import { performDataFrameAbsint, resolveIdToAbstractValue } from '../../../../src/abstract-interpretation/data-frame/absint-visitor';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { equalColNames, equalInterval, leqColNames, leqInterval } from '../../../../src/abstract-interpretation/data-frame/domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from '../../../../src/abstract-interpretation/data-frame/semantics';
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

type DataFrameOperationTypes = {
	[Name in DataFrameOperationName]: {
		[Operation in DataFrameOperation<Name>['operation']]?: DataFrameOperationArgs<Name>
	}
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
 * @param parser   - The parser to use for the data flow graph creation (defaults to the R shell)
 * @param name     - An optional name or test label for the test (defaults to the code)
 */
export function testDataFrameDomain(
	shell: RShell,
	code: string,
	criteria: ([SingleSlicingCriterion, DataFrameDomain | undefined] | [SingleSlicingCriterion, DataFrameDomain | undefined, Partial<DataFrameTestOptions>])[],
	parser: KnownParser = shell,
	name: string | TestLabel = code
) {
	assertDataFrameDomain(parser, code, criteria.map(entry => [entry[0], entry[1]]), name);
	testDataFrameDomainAgainstReal(shell, code, criteria.map(entry => entry.length === 3 ? [entry[0], entry[2]] : entry[0]), parser, name);
}

/**
 * Asserts inferred data frame shape constraints for given slicing criteria.
 *
 * @param parser   - The parser to use for the data flow graph creation
 * @param code     - The code to test
 * @param expected - The expected data frame shape constraints for each slicing criterion
 * @param name     - An optional name or test label for the test (defaults to the code)
 */
export function assertDataFrameDomain(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameDomain | undefined][],
	name: string | TestLabel = code
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const [inferred] = getInferredDomainForCriterion(result, criterion);
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
 */
export function assertDataFrameOperation(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameOperationTypes][],
	name: string | TestLabel = code
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const operations = Object.fromEntries(getInferredOperationsForCriterion(result, criterion)
			.map(op => [op.operation, { ...op.args }]));
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
 * @param parser   - The parser to use for the data flow graph creation (defaults to the R shell)
 * @param name     - An optional name or test label for the test (defaults to the code)
 */
export function testDataFrameDomainAgainstReal(
	shell: RShell,
	code: string,
	/** The options describe whether the inferred properties should match exacly the actual properties or can be an over-approximation (defaults to exact for all properties) */
	criteria: (SingleSlicingCriterion | [SingleSlicingCriterion, Partial<DataFrameTestOptions>])[],
	parser: KnownParser = shell,
	name: string | TestLabel = code
): void {
	test(decorateLabelContext(name, ['absint']), async()=> {
		const result = await createDataflowPipeline(parser, { request: requestFromInput(code) }).allRemainingSteps();
		const testEntries: CriterionTestEntry[] = [];

		for(const entry of criteria) {
			const criterion = Array.isArray(entry) ? entry[0] : entry;
			const options = { ...DataFrameTestExact, ...(Array.isArray(entry) ? entry[1] : {}) };
			const [inferred, node] = getInferredDomainForCriterion(result, criterion);

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
	criterion: SingleSlicingCriterion
): [DataFrameDomain | undefined, RNode<ParentInformation>] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, result.dataflow.graph);
	performDataFrameAbsint(cfg, result.dataflow.graph, result.normalize);
	const value = resolveIdToAbstractValue(node, result.dataflow.graph);

	return [value, node];
}

function getInferredOperationsForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion
): DataFrameOperations[] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = idMap.get(nodeId);

	if(node === undefined) {
		throw new Error(`slicing criterion ${criterion} does not refer to an AST node`);
	}
	const cfg = extractCfg(result.normalize, result.dataflow.graph);
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
	const OutputRegex = /(?<=^|,)(?:\[([^\]]*)\]|([^,]*))/g;
	const result = line.matchAll(OutputRegex)?.map(match => match[1] ?? match[2]).toArray();

	if(result?.length === 4) {
		const dataFrame = result[0] === 'TRUE';
		const colnames = result[1].length > 0 ? result[1].split(',') : [];
		const cols = Number.parseInt(result[2]);
		const rows = Number.parseInt(result[3]);

		return dataFrame ? { colnames: colnames, cols: [cols, cols], rows: [rows, rows] } : undefined;
	}
	return undefined;
}

function getOutputMarker(criterion: SingleSlicingCriterion): string {
	return `SHAPE INFERENCE ${criterion}:`;
}
