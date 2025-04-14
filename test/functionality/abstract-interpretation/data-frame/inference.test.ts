import { describe } from 'vitest';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesTop, DataFrameTop } from '../../../../src/abstract-interpretation/data-frame/domain';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { withShell } from '../../_helper/shell';
import type { DataFrameTestOptions } from './data-frame';
import { assertDataFrameDomain, DataFrameTestOverapproximation, DomainMatchingType, testDataFrameDomainAgainstReal } from './data-frame';

describe.sequential('Data Frame Abstract Interpretation', withShell(shell => {
	function testDataFrameDomain(
		code: string,
		criteria: ([SingleSlicingCriterion, DataFrameDomain] | [SingleSlicingCriterion, DataFrameDomain, Partial<DataFrameTestOptions>])[]
	) {
		assertDataFrameDomain(shell, code, criteria.map(entry => [entry[0], entry[1]]));
		testDataFrameDomainAgainstReal(shell, code, criteria.map(entry => entry.length === 3 ? [entry[0], entry[2]] : entry[0]));
	}

	testDataFrameDomain(
		'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), row.names = NULL)',
		[['1@df', { colnames: ['id', 'age', 'score'], cols: [3, 3], rows: [5, 5] }]]
	);

	testDataFrameDomain(
		'df <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))',
		[['1@df', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }]]
	);

	testDataFrameDomain(
		'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
		[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [9, 9] }, { colnames: DomainMatchingType.Overapproximation }]]
	);

	testDataFrameDomain(
		'df <- data.frame()',
		[['1@df', { colnames: [], cols: [0, 0], rows: [0, 0] }]]
	);

	testDataFrameDomain(
		`
df1 <- data.frame(id = 1:5)
df2 <- df1
		`.trim(),
		[
			['1@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df2', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		'df <- read.csv(text = "id,age\\n1,30\\n2,50\\n3,45")',
		[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
	);

	testDataFrameDomain(
		'df <- eval(parse(text = "data.frame()"))',
		[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:3, type = c("A", "B", "C"))
df <- data.frame()
print(df)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'type'], cols: [2, 2], rows: [3, 3] }],
			['2@df', { colnames: [], cols: [0, 0], rows: [0, 0] }],
			['3@df', { colnames: [], cols: [0, 0], rows: [0, 0] }]
		]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:3, type = c("A", "B", "C"))
print(df <- data.frame())
print(df)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'type'], cols: [2, 2], rows: [3, 3] }],
			['2@df', { colnames: [], cols: [0, 0], rows: [0, 0] }],
			['3@df', { colnames: [], cols: [0, 0], rows: [0, 0] }]
		]
	);

	testDataFrameDomain(
		'df <- 1:3 |> data.frame(type = c("A", "B", "C"))',
		[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
	);

	assertDataFrameDomain(
		shell,
		'df <- if (runif(1) >= 0.5) data.frame(id = 1:5)',
		[['1@df', DataFrameTop]]
	);

	testDataFrameDomain(
		'df <- if (runif(1) >= 0.5) data.frame(id = 1:5) else data.frame(id = 1:10, name = "A")',
		[['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 10] }, DataFrameTestOverapproximation]]
	);

	testDataFrameDomain(
		`
if(runif(1) >= 0.5) {
	df <- data.frame(id = 1:5)
} else {
 	df <- data.frame(id = 1:10, name = "A")
}
print(df)
		`.trim(),
		[['6@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 10] }, DataFrameTestOverapproximation]]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
for (i in 1:5) {
	df[["name"]]
}
df[10, ]
print(df)
		`.trim(),
		[['6@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [5, 10] }, { colnames: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
for (i in 1:5) {
	break
	df[["name"]]
}
df[10, ]
print(df)
		`.trim(),
		[['7@df', { colnames: ['id'], cols: [1, 1], rows: [5, 10] }, { colnames: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
while (TRUE) {
	df[["name"]]
	break
}
df[10, ]
print(df)
		`.trim(),
		[['7@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [5, 10] }, DataFrameTestOverapproximation]]
	);

	assertDataFrameDomain(
		shell, `
df <- data.frame(id = 1:5)
repeat {
	df[["name"]]
}
df[10, ]
print(df)
		`.trim(),
		[['6@df', DataFrameTop]]
	);
}));
