import { assert, beforeAll, test } from 'vitest';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { DataFrameTop, leqColNames, leqInterval } from '../../../../src/abstract-interpretation/data-frame/domain';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import type { TREE_SITTER_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline, DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { RShell } from '../../../../src/r-bridge/shell';
import type { SingleSlicingCriterion, SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assertUnreachable, guard, isNotUndefined } from '../../../../src/util/assert';
import { getRangeEnd } from '../../../../src/util/range';
import { decorateLabelContext, type TestLabel } from '../../_helper/label';

export enum DomainMatchingType {
    Exact = 'exact',
    Overapproximation = 'overapproximation'
}

export type DataFrameTestOptions = Record<keyof DataFrameDomain, DomainMatchingType>;

export const DataFrameTestExact = {
	colnames: DomainMatchingType.Exact,
	cols:     DomainMatchingType.Exact,
	rows:     DomainMatchingType.Exact
};

export const DataFrameTestOverapproximation = {
	colnames: DomainMatchingType.Overapproximation,
	cols:     DomainMatchingType.Overapproximation,
	rows:     DomainMatchingType.Overapproximation
};

/** Stores the inferred data frame constraints and AST node for a tested slicing criterion */
interface CriterionTestEntry {
	criterion:  SingleSlicingCriterion,
	value:      DataFrameDomain,
	node:       RSymbol<ParentInformation>,
	lineNumber: number
}

export function assertDataFrameDomain(
	parser: KnownParser,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameDomain][],
	name: string | TestLabel = code
) {
	let result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;

	beforeAll(async() => {
		result = await createDataflowPipeline(parser, { request: requestFromInput(code) }).allRemainingSteps();
	});

	test.each(expected)(decorateLabelContext(name, ['absint']), (criterion, expect) => {
		guard(isNotUndefined(result), 'Result cannot be undefined');
		const [value] = getInferredDomainForCriterion(result, criterion);

		assert.deepStrictEqual(value.colnames, expect.colnames, 'column names differ');
		assert.deepStrictEqual(value.cols, expect.cols, 'column count differs');
		assert.deepStrictEqual(value.rows, expect.rows, 'row count differs');
	});
}

export function testDataFrameDomainAgainstReal(
	shell: RShell,
	code: string,
	criteria: SlicingCriteria,
	/** Whether the inferred properties should match exacly the actual properties or can be an over-approximation (defaults to exact for all properties) */
	options?: Partial<DataFrameTestOptions>,
	name: string | TestLabel = code
): void {
	const effectiveOptions = { ...DataFrameTestExact, ...options };

	test(decorateLabelContext(name, ['absint']), async()=> {
		const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code)
		}).allRemainingSteps();

		const testEntries: CriterionTestEntry[] = [];

		for(const criterion of criteria) {
			const [value, node] = getInferredDomainForCriterion(result, criterion);
			const lineNumber = getRangeEnd(node.info.fullRange ?? node.location)?.[0];

			if(lineNumber === undefined) {
				throw new Error(`cannot resolve line of criterion ${criterion}`);
			}
			testEntries.push({ criterion, value, node, lineNumber });
		}
		testEntries.sort((a, b) => b.lineNumber - a.lineNumber);
		const lines = code.split('\n');

		for(const { criterion, node, lineNumber } of testEntries) {
			const outputCode = [
				createCodeForOutput('colnames', criterion, node.content),
				createCodeForOutput('cols', criterion, node.content),
				createCodeForOutput('rows', criterion, node.content)
			];
			lines.splice(lineNumber + 1, 0, ...outputCode);
		}
		const instrumentedCode = lines.join('\n');

		shell.clearEnvironment();
		const output = await shell.sendCommandWithOutput(instrumentedCode);

		for(const { criterion, value } of testEntries) {
			const colnames = getRealDomainFromOutput('colnames', criterion, output);
			const cols = getRealDomainFromOutput('cols', criterion, output);
			const rows = getRealDomainFromOutput('rows', criterion, output);

			assertDomainMatching('colnames', value.colnames, colnames, leqColNames, effectiveOptions.colnames);
			assertDomainMatching('cols', value.cols, cols, leqInterval, effectiveOptions.cols);
			assertDomainMatching('rows', value.rows, rows, leqInterval, effectiveOptions.rows);
		}
	});
}

function assertDomainMatching<K extends keyof DataFrameDomain, T extends DataFrameDomain[K]>(
	type: K,
	actual: T,
	expected: T,
	leqFunction: (X1: T, X2: T) => boolean,
	matchingType: DomainMatchingType
): void {
	switch(matchingType) {
		case DomainMatchingType.Exact:
			return assert.deepStrictEqual(actual, expected, `${type} differs`);
		case DomainMatchingType.Overapproximation:
			return assert.isTrue(leqFunction(expected, actual), `${type} is no over-approximation`);
		default:
			assertUnreachable(matchingType);
	}
}

function createCodeForOutput(
	type: keyof DataFrameDomain,
	criterion: SingleSlicingCriterion,
	symbol: string
): string {
	switch(type) {
		case 'colnames':
			return `cat("${getMarker(type, criterion)}", colnames(${symbol}), "\\n")`;
		case 'cols':
			return `cat("${getMarker(type, criterion)}", ncol(${symbol}), "\\n")`;
		case 'rows':
			return `cat("${getMarker(type, criterion)}", nrow(${symbol}), "\\n")`;
		default:
			assertUnreachable(type);
	}
}

function getInferredDomainForCriterion(
	result: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>,
	criterion: SingleSlicingCriterion
): [DataFrameDomain, RSymbol<ParentInformation>] {
	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined || node.type !== RType.Symbol) {
		throw new Error(`slicing criterion ${criterion} does not refer to a R symbol`);
	}
	const value = DataFrameTop;

	return [value, node];
}

function getRealDomainFromOutput<K extends keyof DataFrameDomain>(
	type: K,
	criterion: SingleSlicingCriterion,
	output: string[]
): DataFrameDomain[K] {
	const marker = getMarker(type, criterion);
	const line = output.find(line => line.startsWith(marker))?.replace(marker, '').trim();

	if(line === undefined) {
		throw new Error(`cannot parse ${type} output of instrumented code for ${criterion}`);
	}
	switch(type) {
		case 'colnames': {
			const value = line.length > 0 ? line.split(' ') : [];
			return value as DataFrameDomain[K];
		}
		case 'cols':
		case 'rows': {
			const value = Number.parseInt(line);
			return [value, value] as DataFrameDomain[K];
		}
		default:
			assertUnreachable(type);
	}
}

function getMarker(type: keyof DataFrameDomain, criterion: SingleSlicingCriterion): string {
	return `${type.toUpperCase()} ${criterion}`;
}
