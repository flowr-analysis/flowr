import { describe } from 'vitest';
import type { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesTop, DataFrameTop, IntervalTop } from '../../../../src/abstract-interpretation/data-frame/domain';
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

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
df <- cbind(df, name = 6:10, label = c("A", "B", "C", "D", "E"))
		`.trim(),
		[
			['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		`
df1 <- data.frame(id = 1:5)
df2 <- data.frame(name = 6:10)
df3 <- data.frame(label = c("A", "B", "C", "D", "E"))
df <- cbind(df1, df2, df3)
		`.trim(),
		[
			['1@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df2', { colnames: ['name'], cols: [1, 1], rows: [5, 5] }],
			['3@df3', { colnames: ['label'], cols: [1, 1], rows: [5, 5] }],
			['4@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		`
df1 <- data.frame(id = 1:5)
df2 <- data.frame(name = 6:10)
df <- cbind(df1, df2, label = c("A", "B", "C", "D", "E"))
		`.trim(),
		[
			['1@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df2', { colnames: ['name'], cols: [1, 1], rows: [5, 5] }],
			['3@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
df <- cbind(df, label = list(name = 6:10))
		`.trim(),
		[
			['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df', { colnames: ColNamesTop, cols: IntervalTop, rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1, name = "A", score = 20)
df <- rbind(df, c(2, "B", 30), c(4, "C", 25))
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [1, 1] }],
			['2@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [3, 3] }]
		]
	);

	testDataFrameDomain(
		`
df1 <- data.frame(id = 1:3, name = c("A", "B", "C"), score = c(20, 30, 25))
df2 <- data.frame(id = 4, name = "D", score = 20)
df3 <- data.frame(id = 5, name = "E", score = 40)
df <- rbind(df1, df2, df3)
		`.trim(),
		[
			['1@df1', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [3, 3] }],
			['2@df2', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [1, 1] }],
			['3@df3', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [1, 1] }],
			['4@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		`
df1 <- data.frame(id = 1:3, name = c("A", "B", "C"), score = c(20, 30, 25))
df2 <- data.frame(id = 4, name = "D", score = 20)
df <- rbind(df1, df2, label = c(5, "E", 40))
		`.trim(),
		[
			['1@df1', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [3, 3] }],
			['2@df2', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [1, 1] }],
			['3@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [5, 5] }]
		]
	);

	testDataFrameDomain(
		`
df <- data.frame(id = 1:5)
df <- rbind(df, list(id = 6:10))
		`.trim(),
		[
			['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
			['2@df', { colnames: ['id'], cols: [1, 1], rows: IntervalTop }, { rows: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, n = 3)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, c(2, 1))
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [2, 2] }, { colnames: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, -2)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [1, 3] }, DataFrameTestOverapproximation]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, n = -c(2, 1))
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [0, 1], rows: [1, 3] }, DataFrameTestOverapproximation]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = 3)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, c(2, 1))
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [2, 2] }, { colnames: DomainMatchingType.Overapproximation }]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, -2)
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [1, 3] }, DataFrameTestOverapproximation]
		]
	);

	testDataFrameDomain(
		`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = -c(2, 1))
		`.trim(),
		[
			['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
			['2@df', { colnames: ['id', 'name'], cols: [0, 1], rows: [1, 3] }, DataFrameTestOverapproximation]
		]
	);
}));
