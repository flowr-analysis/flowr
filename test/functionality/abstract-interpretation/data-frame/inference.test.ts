import { afterAll, beforeAll, describe } from 'vitest';
import { ColNamesTop, DataFrameTop } from '../../../../src/abstract-interpretation/data-frame/domain';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';
import { withShell } from '../../_helper/shell';
import { assertDataFrameDomain, assertDataFrameOperation, DataFrameTestOverapproximation, DomainMatchingType, testDataFrameDomain } from './data-frame';

describe.sequential('Data Frame Shape Inference', withShell(shell => {
	async function installPackage(packageName: string, ...alternatives: string[]) {
		const check = [packageName, ...alternatives ?? []].map(name => `!require("${name}")`).join(' && ');
		await shell.sendCommandWithOutput(`if (${check}) install.packages("${packageName}")`);
	}

	beforeAll(async() => {
		amendConfig(config => config.solver.pointerTracking = false);
		await installPackage('dplyr', 'tidyverse');
		await installPackage('magrittr', 'tidyverse');
		await installPackage('readr', 'tidyverse');
		shell.clearEnvironment();
	}, 60000);

	afterAll(() => {
		amendConfig(config => config.solver.pointerTracking = defaultConfigOptions.solver.pointerTracking);
	});

	describe('Control Flow', () => {
		testDataFrameDomain(
			shell,
			'x <- 42',
			[['1@x', undefined]]
		);

		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:5)
data.frame(id = 1:5) -> df2
df3 <<- data.frame(id = 1:5)
data.frame(id = 1:5) ->> df4
df5 = data.frame(id = 1:5)
assign("df6", data.frame(id = 1:5))
print(df6)
			`.trim(),
			[
				['1@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df2', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['3@df3', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['4@df4', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['5@df5', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['7@df6', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
\`df1\` <- data.frame(id = 1:5)
'df2' <- data.frame(id = 1:5)
"df3" <- data.frame(id = 1:5)
df <- cbind(df1, df2, df3)
			`.trim(),
			[
				['4@df1', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['4@df2', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['4@df3', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
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
			shell,
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
			shell,
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
			shell,
			'df <- 1:3 |> data.frame(type = c("A", "B", "C"))',
			[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		assertDataFrameDomain(
			shell,
			'df <- if (runif(1) >= 0.5) data.frame(id = 1:5)',
			[['1@df', DataFrameTop]]
		);

		testDataFrameDomain(
			shell,
			'df <- if (runif(1) >= 0.5) data.frame(id = 1:5) else data.frame(id = 1:10, name = "A")',
			[['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 10] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
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
			shell,
			`
i <- 5
df <- if (i == 0) {
    data.frame(id = 1:3)
} else if (i == 1) {
    data.frame(id = 1:5)
} else if (i == 2) {
    data.frame(name = 1:10)
} else {
    data.frame(id = 1, name = 1:5)
}
print(df)
			`.trim(),
			[['11@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 10] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
for (i in 1:5) {
	df[2] <- 6:10
}
df[10, ] <- c(6, 11)
print(df)
			`.trim(),
			[['6@df', { colnames: ColNamesTop, cols: [1, 2], rows: [10, 10] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
while (nrow(df) < 10) {
	if (ncol(df) == 1) {
		df <- cbind(df, name = "A")
		next
	}
	df <- rbind(df, c(6, "A"))
}
print(df)
			`.trim(),
			[['9@df', { colnames: ['id', 'name'], cols: [1, Infinity], rows: [5, Infinity] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
while (TRUE) {
	df[2] <- 6:10
	break
}
df[10, ] <- c(6, 11)
print(df)
			`.trim(),
			[['7@df', { colnames: ColNamesTop, cols: [1, 2], rows: [10, 10] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]]
		);

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:5)
repeat {
	df[2] <- 6:10
}
df[10, ] <- c(6, 11)
print(df)
			`.trim(),
			[['6@df', undefined]] // unreachable
		);
	});

	describe('Create', () => {
		testDataFrameDomain(
			shell,
			'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), row.names = NULL)',
			[['1@df', { colnames: ['id', 'age', 'score'], cols: [3, 3], rows: [5, 5] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame("id" = c(1, 2, 3, 5, 6, 7), `category` = c("A", "B", "A", "A", "B", "B"))',
			[['1@df', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(1:5, c("A", "B", "C", "D", "E"), TRUE)',
			[['1@df', { colnames: ColNamesTop, cols: [3, 3], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			`
a = 1; b = "A"
df <- data.frame(id = a, name = b)
			`.trim(),
			[['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [1, 1] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
			[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [9, 9] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(1)',
			[['1@df', { colnames: ColNamesTop, cols: [1, 1], rows: [1, 1] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame()',
			[['1@df', { colnames: [], cols: [0, 0], rows: [0, 0] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(id = NULL)',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(data.frame(1:3))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(list(id = 1:3))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(id = list(num = 1:3, name = 3:1))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(`:D` = 1:3)',
			[['1@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				'df <- data.frame(id = 1:3, id = 4:6)',
				[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
			);

			testDataFrameDomain(
				shell,
				'df <- data.frame(id = 1:3, name = 6:8, row.names = "id")',
				[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
			);
		});

		testDataFrameDomain(
			shell,
			'df <- data.frame(`:D` = 1:3, check.names = FALSE)',
			[['1@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(1:3, fix.empty.names = FALSE)',
			[['1@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);
	});

	describe('Convert', () => {
		testDataFrameDomain(
			shell,
			'df <- as.data.frame(data.frame(1:3))',
			[['1@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(list(id = 1:3))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(c(1, 2, 3))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(1)',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:3, label = c("A", "B", "C"))
df2 <- as.data.frame(df1)
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'label'], cols: [2, 2], rows: [3, 3] }],
				['2@df2', { colnames: ['id', 'label'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), optional = TRUE)',
			[['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), cut.names = 3)',
			[['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), col.names = c("col1", "col2"))',
			[['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), fix.empty.names = FALSE)',
			[['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- as.data.frame(optional = TRUE, fix.empty.names = FALSE, x = data.frame(id = 1:3, name = 4:6))',
			[['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);
	});

	describe('Read', () => {
		testDataFrameDomain(
			shell,
			'df <- read.csv(text = "id,age\\n1,30\\n2,50\\n3,45")',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);
	});

	describe('Col/Row Access', () => {
		assertDataFrameOperation(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df$id
df$\`id\`
df$"id"
df$'id'
			`.trim(),
			[
				['2@$', [{ operation: 'accessCols',  columns: ['id'] }]],
				['3@$', [{ operation: 'accessCols',  columns: ['id'] }]],
				['4@$', [{ operation: 'accessCols',  columns: ['id'] }]],
				['5@$', [{ operation: 'accessCols',  columns: ['id'] }]]
			]
		);

		assertDataFrameOperation(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df["id"]
df[, "id"]
df[["id"]]
df[1]
df[, 1]
df[[1]]
df[1, ]
			`.trim(),
			[
				['2@[', [{ operation: 'accessCols',  columns: ['id'] }, { operation: 'subsetCols', colnames: ['id'] }]],
				['3@[', [{ operation: 'accessCols',  columns: ['id'] }]],
				['4@[[', [{ operation: 'accessCols',  columns: ['id'] }]],
				['5@[', [{ operation: 'accessCols',  columns: [1] }, { operation: 'subsetCols', colnames: [undefined] }]],
				['6@[', [{ operation: 'accessCols',  columns: [1] }]],
				['7@[[', [{ operation: 'accessCols',  columns: [1] }]],
				['8@[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'subsetRows', rows: 1 }]]
			]
		);

		assertDataFrameOperation(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1, "id"]
df[[1, "id"]]
df[1, 1]
df[[1, 1]]
			`.trim(),
			[
				['2@[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id'] }]],
				['3@[[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id'] }]],
				['4@[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: [1] }]],
				['5@[[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: [1] }]]
			]
		);

		assertDataFrameOperation(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c("id", "name")]
df[c(1, 2)]
df[1:2]
df[c(1, 2), ]
df[1:2, ]
df[1, c("id", "name")]
df[1, 1:2]
df[1:2, "id"]
df[1:2, 1]
df[1:2, c("id", "name")]
df[c(1, 3), 1:2]
			`.trim(),
			[
				['2@[', [{ operation: 'accessCols',  columns: ['id', 'name'] }, { operation: 'subsetCols', colnames: ['id', 'name'] }]],
				['3@[', [{ operation: 'accessCols',  columns: [1, 2] }, { operation: 'subsetCols', colnames: [undefined, undefined] }]],
				['4@[', [{ operation: 'accessCols',  columns: [1, 2] }, { operation: 'subsetCols', colnames: [undefined, undefined] }]],
				['5@[', [{ operation: 'accessRows',  rows: [1, 2] }, { operation: 'subsetRows', rows: 2 }]],
				['6@[', [{ operation: 'accessRows',  rows: [1, 2] }, { operation: 'subsetRows', rows: 2 }]],
				['7@[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id', 'name'] }, { operation: 'subsetRows', rows: 1 }, { operation: 'subsetCols', colnames: ['id', 'name'] }]],
				['8@[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetRows', rows: 1 }, { operation: 'subsetCols', colnames: [undefined, undefined] }]],
				['9@[', [{ operation: 'accessRows',  rows: [1, 2] }, { operation: 'accessCols', columns: ['id'] }]],
				['10@[', [{ operation: 'accessRows',  rows: [1, 2] },  { operation: 'accessCols', columns: [1] }]],
				['11@[', [{ operation: 'accessRows',  rows: [1, 2] }, { operation: 'accessCols', columns: ['id', 'name'] }, { operation: 'subsetRows', rows: 2 }, { operation: 'subsetCols', colnames: ['id', 'name'] }]],
				['12@[', [{ operation: 'accessRows',  rows: [1, 3] }, { operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetRows', rows: 2 }, { operation: 'subsetCols', colnames: [undefined, undefined] }]]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df["id"]
			`.trim(),
			[['2@result', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, 1]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, 1]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, ]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [1, 1] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, c("id", "name")]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [1, 1] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, c(1, 2)]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [1, 1] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1:2, c(1, 2)]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [2, 2] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, 1:2]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1:2, ]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [2, 2] }]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 2), 1]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[["id"]]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1]]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1, "id"]]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1, 1]]
			`.trim(),
			[['2@result', undefined]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df["id", drop = TRUE]
			`.trim(),
			[['2@result', { colnames: ['id'], cols: [1,1], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, "id", drop = FALSE]
			`.trim(),
			[['2@result', { colnames: ['id'], cols: [1,1], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[-1, "id", drop = FALSE]
			`.trim(),
			[['2@result', { colnames: ['id'], cols: [1, 1], rows: [2, 2] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(-1, -2), -1, drop = FALSE]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [1, 1], rows: [1, 1] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[, -1]
			`.trim(),
			[['2@result', { colnames: ['id', 'name', 'score'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1)]
			`.trim(),
			[['2@result', { colnames: ['id', 'name', 'score'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1), , drop = FALSE]
			`.trim(),
			[['2@result', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }]]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1), sample(1:3, 1)]
				`.trim(),
				[['2@result', undefined, DataFrameTestOverapproximation]]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[]
			`.trim(),
			[['2@result', { colnames: ['id','name'], cols: [2, 2], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[,]
			`.trim(),
			[['2@result', { colnames: ['id','name'], cols: [2, 2], rows: [3, 3] }]]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0]
				`.trim(),
				[['2@result', { colnames: [], cols: [0, 0], rows: [3, 3] }]]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0, ]
				`.trim(),
				[['2@result', { colnames: ['id','name'], cols: [2, 2], rows: [0, 0] }]]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0, 0]
				`.trim(),
				[['2@result', { colnames: [], cols: [0, 0], rows: [0, 0] }]]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(TRUE, FALSE)]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [0, 2], rows: [3, 3] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[TRUE]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [0, 2], rows: [3, 3] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(TRUE, FALSE), ]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 3] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[df$id == 2, ]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 3] }, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[df$id == 2, "name", drop = FALSE]
			`.trim(),
			[['2@result', { colnames: ['name'], cols: [1, 1], rows: [0, 3] }, DataFrameTestOverapproximation]]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			assertDataFrameOperation(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df[["nam", exact = FALSE]]
				`.trim(),
				[['2@[[', [{ operation: 'accessCols',  columns: undefined }]]]
			);

			assertDataFrameOperation(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df$id[1]
df$id[[1]]
df[["id"]][1]
df[[1]][1]
				`.trim(),
				[
					['2@$', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id'] }]],
					['3@$', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id'] }]],
					['4@[[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: ['id'] }]],
					['5@[[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: [1] }]]
				]
			);

			assertDataFrameOperation(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df[[c(1, 1)]]
				`.trim(),
				[['2@[[', [{ operation: 'accessRows',  rows: [1] }, { operation: 'accessCols', columns: [1] }]]]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c("id", "id")]
				`.trim(),
				[['2@result', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1, 1)]
				`.trim(),
				[['2@result', { colnames: ColNamesTop, cols: [3, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1, 1)]
				`.trim(),
				[['2@result', { colnames: ColNamesTop, cols: [3, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1), ]
			`.trim(),
			[['2@result', { colnames: ['id', 'name'], cols: [2, 2], rows: [2, 2] }]]
		);

		testDataFrameDomain(
			shell,
			'result <- data.frame(id = 1:3, name = 4:6)["id"]',
			[['1@result', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'result <- cbind(data.frame(id = 1:3), name = 4:6)[2]',
			[['1@result', { colnames: ['id', 'name'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]]
		);
	});

	describe('Col/Row Assignment', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$id <- 4:6
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$\`name\` <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$"name" <- letters[1:3]
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df$name <- NULL
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$name[3] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$name[[3]] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df["id"] <- 4:6
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[["name"]] <- letters[1:3]
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[1] <- c("A", "B", "C")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[[2]] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[, "name"] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, ] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id'], cols: [1, 1], rows: [4, 4] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, "id"] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id'], cols: [1, 2], rows: [4, 4] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[[4, "id"]] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id'], cols: [1, 2], rows: [4, 4] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, 1] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [1, 1], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[[4, 1]] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [1, 1], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1, c("id", "name")] <- c(42, "A")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 4], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, c("score", "level")] <- 100
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name', 'score', 'level'], cols: [2, 4], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[4, c(1, 2)] <- 100
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1:2, c(1, 3)] <- 1
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [3, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[3:5, 1:3] <- 1
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [3, 3], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, 1:3] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [3, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1:8, ] <- 0
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [8, 8] }]
			]
		);

		testDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
df[c(1, 4), 1] <- 42
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[-1, "id"] <- 8:9
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 3], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(-1, -2), -1] <- 1
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, -5] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[sample(1:10)] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, Infinity], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[sample(1:10), ] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, Infinity] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[] <- 0
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df["name"] <- NULL
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df[[2]] <- NULL
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(TRUE, FALSE)] <- 3:1
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, Infinity], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[TRUE] <- 42
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, Infinity], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(TRUE, FALSE), ] <- 1
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, Infinity] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[df$id == 2, ] <- c(5, "A")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, Infinity] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[["name"]][3] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df[[1]][3] <- "A"
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Set Names', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(1:5, 6:10)
colnames(df) <- c("id", "name")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(1:5, 6:10)
names(df) <- c("id", "name")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- runif(2)
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- NULL
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- "col"
print(df)
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df)[1] <- "test"
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'test'], cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10, score = 11:15)
colnames(df)[1:2] <- "test"
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'score', 'test'], cols: [3, 3], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df)[-1] <- "test"
print(df)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'test'], cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
rownames(df) <- c("row1", "row2", "row3")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
rownames(df) <- runif(3)
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df) <- list(c("row1", "row2", "row3"), c("col1", "col2"))
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[[1]] <- c("row1", "row2", "row3")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[[2]] <- c("col1", "col2")
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[1:2] <- list(c("row1", "row2", "row3"), c("col1", "col2"))
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[-1] <- list(c("col1", "col2"))
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Col/Row Bind', () => {
		testDataFrameDomain(
			shell,
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
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, 6:10, c("A", "B", "C", "D", "E"))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ColNamesTop, cols: [3, 3], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, name = "A")
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, runif(5))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ColNamesTop, cols: [1, Infinity], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
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
			shell,
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
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, label = list(name = 6:10))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ColNamesTop, cols: [1, Infinity], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(6:10, df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ColNamesTop, cols: [2, 2], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			'df <- cbind(name = c("A", "B", "C"), value = "X", data.frame(id = 1:3, score = c(90, 75, 80)))',
			[['1@df', { colnames: ['name', 'value', 'id', 'score'], cols: [4, 4], rows: [3, 3] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- cbind(id = 1:3, name = 4:6)',
			[['1@df', undefined, DataFrameTestOverapproximation]]
		);

		testDataFrameDomain(
			shell,
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
			shell,
			`
df <- data.frame(id = 1:3, name = 6:8)
df <- rbind(df, row4 = c(4, 9), row5 = c(5, 10))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, 6, 7, 8, 9, 10)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [10, 10] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, runif(5))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, Infinity] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
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
			shell,
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
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, list(id = 6:10))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, Infinity] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(6, df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [6, 6] }]
			]
		);

		testDataFrameDomain(
			shell,
			'df <- rbind(1:2, "X", data.frame(id = 1:3, score = c(90, 75, 80)), c("A", "B"))',
			[['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [6, 6] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- rbind(1:3, 4:6)',
			[['1@df', undefined, DataFrameTestOverapproximation]]
		);
	});

	describe('Head/Tail', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = 12)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [12, 12] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, n = 3)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [6, 6] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, c(2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [2, 2] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(n = -2, x = df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [48, 48] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = -c(2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [48, 48] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = c(-2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [48, 48] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, sample(1:50, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 50] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = 12)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [12, 12] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = 3)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [6, 6] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, c(2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [2, 2] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(n = -2, x = df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [48, 48] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = -c(2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [48, 48] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = c(-2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 1], rows: [48, 48] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, sample(1:50, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [50, 50] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 50] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Subset', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, FALSE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [0, 0] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id > 1)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = "id")
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = 1)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, label))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'label'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c("id", "name"))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = 1:2)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, 2))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id:name)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = sample(1:3, 2))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE, select = c(id, name))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, FALSE, id)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [0, 0] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id == 2, -label)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id > 1, select = c(-name, -label))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -c(id, name))
				`.trim(),
				[
					['2@df', { colnames: ['label'], cols: [1, 1], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -c(1, 2))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -1)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(TRUE, FALSE))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE, TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, id))
				`.trim(),
				[
					['2@df', { colnames: ColNamesTop, cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(1, 1, 1))
				`.trim(),
				[
					['2@df', { colnames: ColNamesTop, cols: [3, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id, drop = TRUE)
				`.trim(),
				[
					['2@df', undefined]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, name), drop = TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);
	});

	describe('Filter', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, FALSE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 0] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, id == 2)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, TRUE, FALSE)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, FALSE, .preserve = TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [0, 0] }]
			]
		);
	});

	describe('Select', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, name)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, "id", "name")
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1, 3)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(id, name))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c("id", "name"))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1:2)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 2], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id:name)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, sample(1:3, 2))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df)
				`.trim(),
				[
					['2@df', { colnames: [], cols: [0, 0], rows: [3, 3] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -name)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'label'], cols: [2, 2], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -name, -label)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, -name)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(-id, -name))
				`.trim(),
				[
					['2@df', { colnames: ['score'], cols: [1, 1], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -c(id, name))
				`.trim(),
				[
					['2@df', { colnames: ['score'], cols: [1, 1], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -c(1, 2))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'score'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, "name", 2)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, \`id\`, "id")
				`.trim(),
				[
					['2@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1, 1, 1)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [1, 1], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, !name)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id | 2)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(id, name) & 1:3)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, contains("a"))
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'label'], cols: [0, 3], rows: [3, 3] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);
		});
	});

	describe('Transform', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- transform(df, id = letters[1:5])
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- transform(df, "name" = letters[1:5])
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- transform(df, name = letters[id], level = score^2)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score', 'name', 'level'], cols: [2, 4], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			assertDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, \`:D\` = 11:15)
				`.trim(),
				[
					['2@df', { colnames: ColNamesTop, cols: [2, 3], rows: [5, 5] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, score = 31:35, \`score\` = 36:40)
				`.trim(),
				[
					['2@df', { colnames: ColNamesTop, cols: [2, 4], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, name = NULL)
				`.trim(),
				[
					['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, "A")
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
				]
			);
		});
	});

	describe('Mutate', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, id = letters[1:5])
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, "name" = letters[1:5])
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, 6:10, 11:15)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ColNamesTop, cols: [2, 3], rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- dplyr::mutate(df, name = letters[id], level = score^2)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score', 'name', 'level'], cols: [2, 4], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, \`:D\` = 11:15)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name', ':D'], cols: [2, 3], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			assertDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, score = 31:35, \`score\` = 36:40)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'score'], cols: [2, 3], rows: [5, 5] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, name = NULL)
				`.trim(),
				[
					['2@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, new = NULL)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, label = "A", .keep = "all")
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name', 'label'], cols: [2, 3], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Group By', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [0, 5] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, \`id\`)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [0, 5] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, name = c("A", "A", "B", "A", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id, name)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name', 'score'], cols: [3, 3], rows: [0, 5] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, group = id + name)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'name', 'score', 'group'], cols: [3, 4], rows: [0, 5] }, { cols: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, name = 6:10, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id + name)
				`.trim(),
				[
					['2@df', { colnames: ColNamesTop, cols: [3, 4], rows: [0, 5] }, DataFrameTestOverapproximation]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id, .add = TRUE)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [0, 5] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, score = mean(score), sum = sum(score))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['2@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [1, 6] }, DataFrameTestOverapproximation]
			]
		);

		testDataFrameDomain(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, category) |> summarize(score = mean(score), sum = sum(score))
			`.trim(),
			[
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['3@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [1, 6] }, DataFrameTestOverapproximation]
			]
		);

		testDataFrameDomain(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, id, category) |> summarize(score = mean(score), sum = sum(score))
			`.trim(),
			[
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['3@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [1, 6] }, { cols: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, 1)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['2@df', { colnames: ColNamesTop, cols: [1, 4], rows: [1, 6] }, DataFrameTestOverapproximation]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'category', 'score'], cols: [0, 3], rows: [1, 6] }, DataFrameTestOverapproximation]
				]
			);

			testDataFrameDomain(
				shell,
				`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, category) |> summarize()
				`.trim(),
				[
					['3@df', { colnames: ['id', 'category', 'score'], cols: [0, 3], rows: [1, 6] }, DataFrameTestOverapproximation]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, score = mean(score), sum = sum(score), .groups = "drop")
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['2@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [1, 6] }, DataFrameTestOverapproximation]
			]
		);
	});

	describe('Left Join', () => {
		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, by = "id")
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'score'], cols: [2, 2], rows: [4, 4] }],
				['2@df2', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['3@df', { colnames: ['id', 'score', 'category'], cols: [3, 3], rows: [4, 4] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::left_join(df1, df2, by = "id")
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['2@df2', { colnames: ['id', 'score'], cols: [2, 2], rows: [4, 4] }],
				['3@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::left_join(df1, df2)
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['2@df2', { colnames: ['id', 'score'], cols: [2, 2], rows: [4, 4] }],
				['3@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, by = c("id", "name"))
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'score', 'category'], cols: [4, 4], rows: [4, 4] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'score', 'category'], cols: [3, 6], rows: [4, 4] }, { cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id")
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [5, 5], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, join_by(id == nr, name))
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [3, 6], rows: [4, Infinity] }, DataFrameTestOverapproximation]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, join_by(score >= level))
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [2, 5], rows: [4, Infinity] }, DataFrameTestOverapproximation]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id", suffix = c(".df1", ".df2"))
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [5, 5], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id", keep = TRUE)
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [2, 4], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "X", category = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "Y", category = c("A", "B", "B", "A", "C", "B"), amount = 16)
df <- dplyr::left_join(df1, df2, by = sample(colnames(df1)[1:3], 2))
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [4, 8], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);
		});
	});

	describe('Merge', () => {
		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = "id")
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'score'], cols: [2, 2], rows: [4, 4] }],
				['2@df2', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['3@df', { colnames: ['id', 'score', 'category'], cols: [3, 3], rows: [4, 4] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- merge(df1, df2, by = "id")
			`.trim(),
			[
				['1@df1', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['2@df2', { colnames: ['id', 'score'], cols: [2, 2], rows: [4, 4] }],
				['3@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [4, 4] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			assertDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'score', 'category'], cols: [2, 4], rows: [4, Infinity] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c("id", "name"))
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'score', 'category'], cols: [4, 4], rows: [4, 4] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'name', 'score', 'category'], cols: [3, 6], rows: [4, Infinity] }, { cols: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'score', 'name', 'category'], cols: [2, 4], rows: [4, Infinity] }, { cols: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c())
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [2, 4], rows: [4, Infinity] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
				]
			);

			assertDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
lst <- list(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, lst, by = "id")
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [2, Infinity], rows: [4, Infinity] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id")
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [5, 5], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by.x = "id", by.y = "nr")
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [3, 6], rows: [4, Infinity] }, DataFrameTestOverapproximation]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- merge(df1, df2, "id", all.x = TRUE)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'score', 'category'], cols: [3, 3], rows: [6, 6] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all.y = TRUE)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'score', 'category'], cols: [3, 3], rows: [6, 6] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all = TRUE)
				`.trim(),
				[
					['3@df', { colnames: ['id', 'score', 'category'], cols: [3, 3], rows: [6, 6] }]
				]
			);

			testDataFrameDomain(
				shell,
				`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", no.dups = FALSE)
				`.trim(),
				[
					['3@df', { colnames: ColNamesTop, cols: [5, 5], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
				]
			);
		});
	});

	describe('Rearrange', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, category)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, score, .before = category)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }]
			]
		);

		describe('Currently Unsupported', { fails: true }, () => {
			testDataFrameDomain(
				shell,
				`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, label = category)
				`.trim(),
				[
					['2@df', { colnames: ['id', 'label', 'score'], cols: [3, 3], rows: [5, 5] }]
				]
			);
		});

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::arrange(df, -score, id)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::arrange(df, desc(score))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [5, 5] }]
			]
		);
	});

	describe('General', () => {
		testDataFrameDomain(
			shell,
			`
library(dplyr)

df1 <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95))
df2 <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))
df3 <- df1 %>%
    filter(age > 30) %>%
    mutate(level = score^2) %>%
    left_join(df2, by = "id") %>%
    select(-age)

print(df3$level)
			`.trim(),
			[
				['3@df1', { colnames: ['id', 'age', 'score'], cols: [3, 3], rows: [5, 5] }],
				['4@df2', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }],
				['11@df3', { colnames: ['id', 'score', 'level', 'category'], cols: [3, 4], rows: [0, 5] }, { cols: DomainMatchingType.Overapproximation, rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, age = c(25, 30, 40))
df <- df |> subset(age < 30)
df <- df |> rbind(c(4, 32), c(5, 35))
df <- df[2:3, 1:2]
			`.trim(),
			[
				['1@df', { colnames: ['id', 'age'], cols: [2, 2], rows: [3, 3] }],
				['2@df', { colnames: ['id', 'age'], cols: [2, 2], rows: [0, 3] }, { rows: DomainMatchingType.Overapproximation }],
				['3@df', { colnames: ['id', 'age'], cols: [2, 2], rows: [2, 5] }, { rows: DomainMatchingType.Overapproximation }],
				['4@df', { colnames: ['id', 'age'], cols: [2, 2], rows: [2, 2] }],
			]
		);
	});
}));
