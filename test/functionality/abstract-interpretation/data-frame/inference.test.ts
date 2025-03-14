import { describe } from 'vitest';
import { withShell } from '../../_helper/shell';
import { ColNamesTop, DataFrameTop } from '../../../../src/abstract-interpretation/data-frame/domain';
import { testDataFrameDomain, assertDataFrameDomain, DomainMatchingType, DataFrameTestOverapproximation } from './data-frame';

describe.sequential('Data Frame Abstract Interpretation', withShell(shell => {
	assertDataFrameDomain(
		shell,
		'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), row.names = NULL)',
		'1@df',
		{
			colnames: ['id', 'age', 'score'],
			cols:     [3, 3],
			rows:     [5, 5]
		}
	);

	testDataFrameDomain(
		shell,
		'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), row.names = NULL)',
		'1@df'
	);

	assertDataFrameDomain(
		shell,
		'df <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))',
		'1@df',
		{
			colnames: ['id', 'category'],
			cols:     [2, 2],
			rows:     [6, 6]
		}
	);

	testDataFrameDomain(
		shell,
		'df <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))',
		'1@df'
	);

	assertDataFrameDomain(
		shell,
		'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
		'1@df',
		{
			colnames: ColNamesTop,
			cols:     [2, 2],
			rows:     [9, 9]
		}
	);

	testDataFrameDomain(
		shell,
		'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
		'1@df',
		{ colnames: DomainMatchingType.Overapproximation }
	);

	assertDataFrameDomain(
		shell,
		'df <- data.frame()',
		'1@df',
		{
			colnames: [],
			cols:     [0, 0],
			rows:     [0, 0]
		}
	);

	testDataFrameDomain(
		shell,
		'df <- data.frame()',
		'1@df'
	);

	assertDataFrameDomain(
		shell,
		'df1 <- data.frame(id = 1:5); df2 <- df1',
		'1@df2',
		{
			colnames: ['id'],
			cols:     [1, 1],
			rows:     [5, 5]
		}
	);

	testDataFrameDomain(
		shell,
		'df1 <- data.frame(id = 1:5); df2 <- df1',
		'1@df2'
	);

	assertDataFrameDomain(
		shell,
		'df <- read.csv("test.csv")',
		'1@df',
		DataFrameTop
	);

	testDataFrameDomain(
		shell,
		'df <- read.csv(text = "id,age\\n1,30\\n2,50\\n3,45")',
		'1@df',
		DataFrameTestOverapproximation
	);

	assertDataFrameDomain(
		shell,
		'df <- eval(parse(text = "data.frame()"))',
		'1@df',
		DataFrameTop
	);

	testDataFrameDomain(
		shell,
		'df <- eval(parse(text = "data.frame()"))',
		'1@df',
		DataFrameTestOverapproximation
	);
}));
