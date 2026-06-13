import { assert, test } from 'vitest';
import type { AbsintVisitorConfiguration } from '../../../../src/abstract-interpretation/absint-visitor';
import { type AbstractDataFrameShape, DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/dataframe-domain';
import type { DataFrameOperationArgs, DataFrameOperationName } from '../../../../src/abstract-interpretation/data-frame/semantics';
import { type DataFrameOperations, DataFrameShapeInferenceVisitor } from '../../../../src/abstract-interpretation/data-frame/shape-inference';
import type { AbstractValue } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { Bottom, type Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { SetRangeDomain } from '../../../../src/abstract-interpretation/domains/set-range-domain';
import { FlowrConfig } from '../../../../src/config';
import { RoleInParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/role';
import type { RShell } from '../../../../src/r-bridge/shell';
import { type SlicingCriteria, SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { guard, isNotUndefined } from '../../../../src/util/assert';
import { Record } from '../../../../src/util/record';
import { type TestLabel, decorateLabelContext } from '../../_helper/label';
import { type TestConfiguration, skipTestBecauseConfigNotMet } from '../../_helper/shell';
import { type InferenceTestCase, type InferenceTestOptions, runInference, testInferredValues } from '../inference';

/**
 * The expected data frame shape for data frame shape tests.
 */
export interface ExpectedDataFrameShape {
	colnames: [min: string[], range: string[] | typeof Top] | typeof Bottom,
	cols:     AbstractValue<AbstractDataFrameShape['cols']>,
	rows:     AbstractValue<AbstractDataFrameShape['rows']>
}

/**
 * The expected abstract data frame operation for data frame operation tests with the operation name and its arguments.
 */
type ExpectedDataFrameOperation = {
	[Name in DataFrameOperationName]: { operation: Name } & DataFrameOperationArgs<Name>
}[DataFrameOperationName];

/**
 * The test options for data frame shape inference tests, extending the general {@link TestConfiguration} and {@link InferenceTestOptions}.
 */
export interface DataFrameTestOptions extends InferenceTestOptions, Partial<TestConfiguration> {
	/** An optional name or test label for the test (defaults to the code) */
	readonly name?: string | TestLabel;
}

/**
 * Combined test to assert that the inferred data frame shapes match expected values for given slicing criteria and
 * validate the inferred shapes against the actual values at these locations when running the code.
 * When only providing a list of locations (slicing criteria), only the validation test is performed.
 * The `skipRun` option of the test options can be used to skip the validation test (skip running the code) and only perform the assertion test.
 * Only slicing criteria for symbols are allowed (e.g., no slicing criteria for function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the code in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell - The R shell to use to run the code.
 * @param code - The R code to infer the data frame shape for and to run for validation.
 * @param expected - The expected data frame shape constraints for each slicing criterion to test or a list of slicing criteria to validate the inferred shape for.
 * @param options - The test configuration options, including the name for the test and whether the execution should be skipped (see {@link TestConfiguration} and {@link DataFrameTestOptions}).
 */
export function testInferredDataFrameShape(
	shell: RShell,
	code: string,
	expected: InferenceTestCase<ExpectedDataFrameShape> | SlicingCriteria,
	options?: DataFrameTestOptions
) {
	const test = Array.isArray(expected) ? expected : Record.mapProperties(expected, expectedShape => toDataFrameDomain(expectedShape, options?.config));
	const inference = (config: AbsintVisitorConfiguration) => new DataFrameShapeInferenceVisitor({ ...config, trackOperations: false });
	testInferredValues(options?.name ?? code.trim(), shell, code, test, inference, createOutputCode, parseOutput, options);
}

/**
 * Combined test for code reading data from external files with one run for the file argument without running the code and
 * another run for the text argument with running the code via {@link testInferredDataFrameShape}.
 * This ensures that the code is only executed for the text argument.
 * Only slicing criteria for symbols are allowed (e.g., no slicing criteria for function calls or operators).
 *
 * Note that this functions inserts print statements for the shape properties in the code in the line after each slicing criterion.
 * Make sure that this does not break the provided code.
 * @param shell - The R shell to use to run the code.
 * @param fileArg - The file argument for the assertion run
 * @param textArg - The text argument for the validation run where the code is executed.
 * @param getCode - A function to get the R code for `fileArg` or `textArg` to infer the data frame shape for and to run for validation.
 * @param expected - The expected data frame shape constraints for each slicing criterion to test or a list of slicing criteria to validate the inferred shape for.
 * @param options - The test configuration options, including the name for the test and whether the execution should be skipped (see {@link TestConfiguration} and {@link DataFrameTestOptions}).
 */
export function testInferredDataFrameShapeWithSource(
	shell: RShell,
	fileArg: string, textArg: string,
	getCode: (arg: string) => string,
	expected: InferenceTestCase<ExpectedDataFrameShape> | SlicingCriteria,
	options?: DataFrameTestOptions
) {
	testInferredDataFrameShape(shell, getCode(fileArg), expected, { ...options, skipRun: true });
	testInferredDataFrameShape(shell, getCode(textArg), expected, options);
}

/**
 * Tests that the mapped abstract data frame operations for given slicing criteria include expected abstract operations.
 * @param code - The R code to map the abstract operations for.
 * @param expected - A subset of the expected abstract data frame operations for each slicing criterion.
 * @param options - The test configuration options, including the name for the test and whether the execution should be skipped (see {@link TestConfiguration} and {@link DataFrameTestOptions}).
 */
export function testMappedDataFrameOperations(
	code: string,
	expected: InferenceTestCase<ExpectedDataFrameOperation[]>,
	options?: DataFrameTestOptions
) {
	test.skipIf(skipTestBecauseConfigNotMet(options))(decorateLabelContext(options?.name ?? code.trim(), ['absint']), async() => {
		const result = await runInference(code.trim(), config => new DataFrameShapeInferenceVisitor(config), options);

		for(const [criterion, expectedOperations] of Record.entries(expected)) {
			const operations = getInferredOperationsForCriterion(result, criterion) ?? [];
			assert.containsSubset(operations, expectedOperations, `Expected abstract operations for criterion "${criterion}" to include ${JSON.stringify(expectedOperations)}, but got ${JSON.stringify(operations)}`);
		}
	});
}

/**
 * Converts an expected data frame shape to a data frame domain.
 * @param shape - The expected data frame shape to convert to a data frame domain.
 * @param config - An optional flowR configuration to use for the conversion (only the `abstractInterpretation.dataFrame.maxColNames` option is used, defaults to {@link FlowrConfig.default}).
 * @returns The data frame domain representing the expected data frame shape, or `undefined` if the expected shape is `undefined`.
 */
function toDataFrameDomain(shape: ExpectedDataFrameShape | undefined, config?: FlowrConfig): DataFrameDomain | undefined {
	if(shape === undefined) {
		return undefined;
	}
	const maxColNames = config?.abstractInterpretation.dataFrame.maxColNames ?? FlowrConfig.default().abstractInterpretation.dataFrame.maxColNames;

	return new DataFrameDomain({
		colnames: new SetRangeDomain(shape.colnames === Bottom ? Bottom : { min: shape.colnames[0], range: shape.colnames[1] }, maxColNames),
		cols:     new IntervalDomain(shape.cols),
		rows:     new IntervalDomain(shape.rows)
	});
}

/**
 * Retrieves the mapped abstract data frame operations for a given slicing criterion from the results of the inference.
 * @param inference - The data frame shape inference visitor after performing the inference, which contains the mapped abstract operations.
 * @param criterion - The slicing criterion for which to retrieve the abstract operations.
 * @returns The mapped abstract operations for the given slicing criterion, or `undefined` if no operations were mapped for it.
 */
function getInferredOperationsForCriterion(inference: DataFrameShapeInferenceVisitor, criterion: SlicingCriterion): Readonly<DataFrameOperations> {
	const idMap = inference.config.normalizedAst.idMap;
	let nodeId = SlicingCriterion.parse(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node?.info.role === RoleInParent.FunctionCallName) {
		nodeId = node.info.parent ?? nodeId;
	}
	guard(isNotUndefined(nodeId), `Slicing criterion ${criterion} does not refer to an AST node`);

	return inference.getAbstractOperations(nodeId);
}

/**
 * Creates the R code to output the data frame shape properties of a symbol for validating the inferred data frame shape for a slicing criterion.
 * The output includes whether the symbol is a data frame, its column names, and the number of columns and rows.
 */
function createOutputCode(marker: string, symbol: string): string {
	return `cat(sprintf("${marker}: %s,%s,%s,%s\\n", is.data.frame(${symbol}), paste(names(${symbol}), collapse = ";"), paste(ncol(${symbol}), collapse = ""), paste(nrow(${symbol}), collapse = "")))`;
}

/**
 * Parses the output of the instrumented code to extract the data frame shape properties and create a data frame domain for validating the inferred data frame shape for a slicing criterion.
 */
function parseOutput(output: string): DataFrameDomain | undefined {
	const OutputRegex = /(TRUE|FALSE),(.*),(\w*),(\w*)$/;
	const result = output.match(OutputRegex);

	if(result?.length === 5) {
		const dataFrame = result[1] === 'TRUE';
		const colnames = result[2].length > 0 ? result[2].split(';') : [];
		const cols = Number.parseInt(result[3]);
		const rows = Number.parseInt(result[4]);

		if(dataFrame) {
			return toDataFrameDomain({ colnames: [colnames, []], cols: [cols, cols], rows: [rows, rows] });
		}
	}
}
