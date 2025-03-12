import { assert, describe, test } from 'vitest';
import { withShell } from '../../_helper/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { AbstractInterpretationInfo } from '../../../../src/abstract-interpretation/data-frame/processor-decorator';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesTop, DataFrameTop, IntervalBottom } from '../../../../src/abstract-interpretation/data-frame/domain';

enum DomainMatchingType {
    Exact = 'exact',
    Overapproximation = 'overapproximation'
}

interface DataFrameTestOptions {
    colnames: DomainMatchingType,
    cols:     DomainMatchingType,
    rows:     DomainMatchingType
}

const DefaultDataFrameTestOptions = {
	colnames: DomainMatchingType.Exact,
	cols:     DomainMatchingType.Exact,
	rows:     DomainMatchingType.Exact
};

describe.sequential('Data Frame Abstract Interpretation', withShell(shell => {
	function assertDataFrameDomain(code: string, criterion: SingleSlicingCriterion, expected: DataFrameDomain, options?: Partial<DataFrameTestOptions>) {
		const effectiveOptions = { ...DefaultDataFrameTestOptions, ...options };
		return test(code, async()=> {
			const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code)
			}).allRemainingSteps();

			const idMap = result.dataflow.graph.idMap ?? result.normalize.idMap;
			const nodeId = slicingCriterionToId(criterion, idMap);
			const node = idMap.get(nodeId);
			const info = node?.info as AbstractInterpretationInfo;
			let value = DataFrameTop;

			if(node !== undefined && info.dataFrame?.type === 'symbol') {
				value = info.dataFrame.value;
			}
			if(effectiveOptions.colnames === DomainMatchingType.Exact) {
				assert.deepStrictEqual(value.colnames, expected.colnames, 'column names differ');
			} else if(effectiveOptions.colnames === DomainMatchingType.Overapproximation) {
				assert.isTrue(value.colnames === ColNamesTop || new Set(expected.colnames).isSubsetOf(new Set(value.colnames)), 'column names are no overapproximation');
			}
			if(effectiveOptions.cols === DomainMatchingType.Exact) {
				assert.deepStrictEqual(value.cols, expected.cols, 'column count differs');
			} else if(effectiveOptions.cols === DomainMatchingType.Overapproximation) {
				assert.isTrue(expected.cols === IntervalBottom || (value.cols !== IntervalBottom && value.cols[0] <= expected.cols[0] && value.cols[1] >= expected.cols[1]), 'column count is no overapproximation');
			}
			if(effectiveOptions.rows === DomainMatchingType.Exact) {
				assert.deepStrictEqual(value.rows, expected.rows, 'row count differs');
			} else if(effectiveOptions.rows === DomainMatchingType.Overapproximation) {
				assert.isTrue(expected.rows === IntervalBottom || (value.rows !== IntervalBottom && value.rows[0] <= expected.rows[0] && value.rows[1] >= expected.rows[1]), 'row count is no overapproximation');
			}
		});
	}

	assertDataFrameDomain(
		'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), row.names = NULL)',
		'1@df',
		{
			colnames: ['id', 'age', 'score'],
			cols:     [3, 3],
			rows:     [5, 5]
		}
	);

	assertDataFrameDomain(
		'df <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))',
		'1@df',
		{
			colnames: ['id', 'category'],
			cols:     [2, 2],
			rows:     [6, 6]
		}
	);

	assertDataFrameDomain(
		'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
		'1@df',
		{
			colnames: ColNamesTop,
			cols:     [2, 2],
			rows:     [9, 9]
		}
	);

	assertDataFrameDomain(
		'df <- data.frame()',
		'1@df',
		{
			colnames: [],
			cols:     [0, 0],
			rows:     [0, 0]
		}
	);

	assertDataFrameDomain(
		'df1 <- data.frame(id = 1:5); df2 <- df1',
		'1@df2',
		{
			colnames: ['id'],
			cols:     [1, 1],
			rows:     [5, 5]
		}
	);

	assertDataFrameDomain(
		'df <- read.csv("test.csv")',
		'1@df',
		DataFrameTop
	);
}));
