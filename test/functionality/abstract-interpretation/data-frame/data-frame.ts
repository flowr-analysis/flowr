import { assert, test } from 'vitest';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { DataFrameTop, leqColNames, leqInterval } from '../../../../src/abstract-interpretation/data-frame/domain';
import type { AbstractInterpretationInfo } from '../../../../src/abstract-interpretation/data-frame/absint-info';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { RShell } from '../../../../src/r-bridge/shell';
import type { SingleSlicingCriterion, SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assertUnreachable } from '../../../../src/util/assert';
import { getRangeEnd } from '../../../../src/util/range';
import type { RSymbol } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';

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

interface CriterionTestEntry {
	criterion:  SingleSlicingCriterion,
	value:      DataFrameDomain,
	node:       RSymbol<object>,
	lineNumber: number
}

export function assertDataFrameDomain(
	shell: RShell,
	code: string,
	expected: [SingleSlicingCriterion, DataFrameDomain][],
	name: string = code
) {
	test.each(expected)(name, async(criterion, expect) => {
		const [value] = await getInferredDomainForCriterion(shell, code, criterion);

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
	name: string = code
): void {
	const effectiveOptions = { ...DataFrameTestExact, ...options };
	test(name, async()=> {
		const testEntries: CriterionTestEntry[] = [];

		for(const criterion of criteria) {
			const [value, node] = await getInferredDomainForCriterion(shell, code, criterion);
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

async function getInferredDomainForCriterion(
	shell: RShell,
	code: string,
	criterion: SingleSlicingCriterion
): Promise<[DataFrameDomain, RSymbol<object>]> {
	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:  shell,
		request: requestFromInput(code)
	}).allRemainingSteps();

	const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
	const nodeId = slicingCriterionToId(criterion, idMap);
	const node = idMap.get(nodeId);

	if(node === undefined || node.type !== RType.Symbol) {
		throw new Error(`slicing criterion ${criterion} does not refer to a R symbol`);
	}
	const info = node.info as AbstractInterpretationInfo;
	const value = info.dataFrame?.type === 'symbol' ? info.dataFrame.value : DataFrameTop;

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
		throw new Error(`cannot parse output of instrumented code for ${type}`);
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
