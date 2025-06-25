import { afterAll, beforeAll, describe } from 'vitest';
import { ColNamesTop, DataFrameTop, IntervalTop } from '../../../../src/abstract-interpretation/data-frame/domain';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';
import { withShell } from '../../_helper/shell';
import { assertDataFrameDomain, DataFrameTestOverapproximation, DomainMatchingType, testDataFrameDomain } from './data-frame';

describe.sequential('Data Frame Shape Inference', withShell(shell => {
	const skipLibraries = 'GITHUB_ACTIONS' in process.env;

	beforeAll(() => {
		amendConfig(config => config.solver.pointerTracking = false);
	});

	afterAll(() => {
		amendConfig(config => config.solver.pointerTracking = defaultConfigOptions.solver.pointerTracking);
	});

	describe('Control Flow', () => {
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
			'df <- eval(parse(text = "data.frame()"))',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
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
			[['6@df', DataFrameTop]]
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
			'df <- data.frame(id = c(1, 2, 3, 5, 6, 7), category = c("A", "B", "A", "A", "B", "B"))',
			[['1@df', { colnames: ['id', 'category'], cols: [2, 2], rows: [6, 6] }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
			[['1@df', { colnames: ColNamesTop, cols: [2, 2], rows: [9, 9] }, { colnames: DomainMatchingType.Overapproximation }]]
		);

		testDataFrameDomain(
			shell,
			'df <- data.frame()',
			[['1@df', { colnames: [], cols: [0, 0], rows: [0, 0] }]]
		);
	});

	describe('Convert', () => {
		testDataFrameDomain(
			shell,
			'df <- as.data.frame(c(1, 2, 3))',
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
	});

	describe('Read', () => {
		testDataFrameDomain(
			shell,
			'df <- read.csv(text = "id,age\\n1,30\\n2,50\\n3,45")',
			[['1@df', DataFrameTop, DataFrameTestOverapproximation]]
		);
	});

	describe('Col/Row Access', () => {
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

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, 1]
			`.trim(),
			[['2@result', DataFrameTop]]
		);

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, 1]
			`.trim(),
			[['2@result', DataFrameTop,]]
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

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 2), 1]
			`.trim(),
			[['2@result', DataFrameTop]]
		);

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[["id"]]
			`.trim(),
			[['2@result', DataFrameTop]]
		);

		assertDataFrameDomain(
			shell, `
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1]]
			`.trim(),
			[['2@result', DataFrameTop]]
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
df <- data.frame(id = 1:3, name = 4:6)
result <- df[,]
			`.trim(),
			[
				['1@df', { colnames: ['id','name'], cols: [2, 2], rows: [3, 3] }],
				['2@result', { colnames: ['id','name'], cols: [2, 2], rows: [3, 3] }],
			]
		);
	});

	describe('Col/Row Assignment', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3)
df$id <- "A"
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
df$name <- "A"
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
df[["name"]] <- "A"
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
df[1] <- "A"
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
df[2] <- "A"
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
df[4, 1] <- 4
print(df)
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [3, 3] }],
				['3@df', { colnames: ColNamesTop, cols: [1, 1], rows: [4, 4] }, { colnames: DomainMatchingType.Overapproximation }]
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
names(df) <- runif(2)
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
dimnames(df) <- list(c("row1", "row2", "row3"), c("col1", "col2"))
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
				['2@df', { colnames: ColNamesTop, cols: IntervalTop, rows: [5, 5] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
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
				['2@df', { colnames: ['id'], cols: [1, 1], rows: IntervalTop }, { rows: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Head/Tail', () => {
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

		testDataFrameDomain(
			shell,
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
			shell,
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
			shell,
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

		testDataFrameDomain(
			shell,
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
			shell,
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
			shell,
			`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = -c(2, 1))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [3, 5] }, DataFrameTestOverapproximation],
				['2@df', { colnames: ['id', 'name'], cols: [0, 1], rows: [1, 3] }, DataFrameTestOverapproximation]
			]
		);
	});

	describe('Subset', () => {


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

		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(-id, -name))
			`.trim(),
			[
				['1@df', { colnames: ['id', 'name', 'label'], cols: [3, 3], rows: [3, 3] }],
				['2@df', { colnames: ['label'], cols: [1, 1], rows: [3, 3] }]
			]
		);
	});

	describe('Filter', { skip: skipLibraries }, () => {
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
	});

	describe('Select', { skip: skipLibraries }, () => {
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
	});

	describe('Transform', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- transform(df, id = c(letters[1:5]))
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
df <- transform(df, name = c(letters[1:5]))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Mutate', { skip: skipLibraries }, () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, id = c(letters[1:5]))
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
df <- dplyr::mutate(df, name = c(letters[1:5]))
			`.trim(),
			[
				['1@df', { colnames: ['id'], cols: [1, 1], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'name'], cols: [1, 2], rows: [5, 5] }, { cols: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Group By', { skip: skipLibraries }, () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id) |> as.data.frame()
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [0, 5] }, { rows: DomainMatchingType.Overapproximation }]
			]
		);

		testDataFrameDomain(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- df |>
	group_by(category) |>
	summarise(score = mean(score), sum = sum(score)) |>
	as.data.frame()
print(df)
			`.trim(),
			[
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['7@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [0, 6] }, DataFrameTestOverapproximation]
			]
		);

		testDataFrameDomain(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- df |>
	summarise(score = mean(score), sum = sum(score)) |>
	as.data.frame()
print(df)
			`.trim(),
			[
				['2@df', { colnames: ['id', 'category', 'score'], cols: [3, 3], rows: [6, 6] }],
				['6@df', { colnames: ['id', 'category', 'score', 'sum'], cols: [2, 5], rows: [1, 1] }, { colnames: DomainMatchingType.Overapproximation, cols: DomainMatchingType.Overapproximation }]
			]
		);
	});

	describe('Left Join', { skip: skipLibraries }, () => {
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
	});

	describe('Aggregate', () => {
		testDataFrameDomain(
			shell,
			`
df <- data.frame(id = c(1, 2, 3, 1, 3), score = c(80, 75, 90, 70, 85))
df <- aggregate(df, list(group = df$id), mean)
			`.trim(),
			[
				['1@df', { colnames: ['id', 'score'], cols: [2, 2], rows: [5, 5] }],
				['2@df', DataFrameTop, DataFrameTestOverapproximation]
			]
		);
	});

	describe('Rearrange', { skip: skipLibraries }, () => {
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
	});

	describe('General', { skip: skipLibraries }, () => {
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
