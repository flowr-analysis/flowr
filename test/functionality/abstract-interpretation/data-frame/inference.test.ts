import { beforeAll, describe } from 'vitest';
import { Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { PosIntervalTop } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { MIN_VERSION_LAMBDA, MIN_VERSION_PIPE } from '../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { withShell } from '../../_helper/shell';
import { testMappedDataFrameOperations, testInferredDataFrameShape, testInferredDataFrameShapeWithSource } from './data-frame';

/** The minimum version required for calling `head` and `tail` with a vector argument, e.g. `head(df, c(1, 2))` */
export const MIN_VERSION_HEAD_TAIL_VECTOR = '4.0.0';

const DataFrameTop = { colnames: [[], Top] as [[], typeof Top], cols: PosIntervalTop, rows: PosIntervalTop } as const;

describe.sequential('Data Frame Shape Inference', withShell(shell => {
	let librariesInstalled = false;
	const skipLibraries = () => !librariesInstalled;

	const sources = {
		'a.csv': 'id,name,"score"\n1,"A",95\n2,"B",80\n4,"A",85',
		'b.csv': 'id,name,\'score\'\r\n1,\'A\',95\r\n2,\'B\',80\r\n4,\'A\',85',
		'c.csv': '# this is a comment :D\n\n,"id,number","""unique"" name" #this is a comment\n\n"1",1,6\n\n"2",2,7\n\n"3",3,8\n\n"4",4,9\n\n"5",5,10\n',
		'd.csv': '1;3,5;banana\r\n2;7,8;apple\r\n3;4,2;peach\r\n4;1,9;grape\r\n',
		'e.csv': 'first last     state phone\nJohn  Smith    WA    418-Y11-4111\nMary  Hartford CA    319-Z19-4341\nEvan  Nolan    IL    219-532-c301\n',
		'f.csv': 'name\tname\tstate\tphone\nJohn\tSmith\tWA\t418-Y11-4111\nMary\tHartford\tCA\t319-Z19-4341\nEvan\tNolan\tIL\t219-532-c301',
		'g.csv': 'id,name,"score"\r1,"A",95\r2,"B",80\r4,"A",85'
	} as const satisfies Readonly<Record<string, string>>;

	const sourceFiles = Object.entries(sources).map(([path, content]) => new FlowrInlineTextFile(path, content));

	function getFileContent(source: keyof typeof sources) {
		return sources[source].replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\t', ' \\t').replaceAll('"', '\\"');
	}

	beforeAll(async() => {
		librariesInstalled = await shell.isPackageInstalled('dplyr') && await shell.isPackageInstalled('readr');
		shell.clearEnvironment();
	});

	describe('Control Flow', () => {
		testInferredDataFrameShape(
			shell,
			'x <- 42',
			{ '1@x': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:5)
data.frame(id = 1:5) -> df2
df3 <<- data.frame(id = 1:5)
data.frame(id = 1:5) ->> df4
df5 = data.frame(id = 1:5)
assign("df6", data.frame(id = 1:5))
print(df6)
			`,
			{
				'1@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df2': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'3@df3': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'4@df4': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'5@df5': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'7@df6': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:5)
assign(paste0("df1"), 42)
print(df1)
			`,
			{
				'1@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'3@df1': undefined
			}
		);

		testInferredDataFrameShape(
			shell,
			`
\`df1\` <- data.frame(id = 1:5)
'df2' <- data.frame(id = 1:5)
"df3" <- data.frame(id = 1:5)
df <- cbind(df1, df2, df3)
			`,
			{
				'4@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'4@df2': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'4@df3': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:5)
df2 <- df1
			`,
			{
				'1@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df2': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, type = c("A", "B", "C"))
df <- data.frame()
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'type'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] },
				'3@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, type = c("A", "B", "C"))
print(df <- data.frame())
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'type'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] },
				'3@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] }
			}
		);

		testInferredDataFrameShape(
			shell,
			'df <- 1:3 |> data.frame(type = c("A", "B", "C"))',
			{ '1@df': { colnames: [['type'], Top], cols: [2, 2], rows: [3, 3] } },
			{ minRVersion: MIN_VERSION_PIPE }
		);

		testInferredDataFrameShape(
			shell,
			'df <- if (runif(1) >= 0.5) data.frame(id = 1:5)',
			{ '1@df': undefined }
		);

		testInferredDataFrameShape(
			shell,
			'df <- if (runif(1) >= 0.5) data.frame(id = 1:5) else data.frame(id = 1:10, name = "A")',
			{ '1@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [5, 10] } }
		);

		testInferredDataFrameShape(
			shell,
			`
if(runif(1) >= 0.5) {
	df <- data.frame(id = 1:5)
} else {
 	df <- data.frame(id = 1:10, name = "A")
}
print(df)
			`,
			{ '6@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [5, 10] } }
		);

		testInferredDataFrameShape(
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
			`,
			{ '11@df': { colnames: [[], ['id', 'name']], cols: [1, 2], rows: [3, 10] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
for (i in 1:5) {
	df[2] <- 6:10
}
df[10, ] <- c(6, 11)
print(df)
			`,
			{ '6@df': { colnames: [['id'], Top], cols: [1, 2], rows: [10, 10] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
while (nrow(df) < 10) {
	df <- rbind(df, 10)
}
print(df)
			`,
			{ '5@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
repeat {
	df <- rbind(df, 10)
	if (nrow(df) > 10) {
		break
	}
}
print(df)
			`,
			{ '8@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
repeat {
	if (nrow(df) > 10) {
		break
	}
	df <- rbind(df, 10)
}
print(df)
			`,
			{ '8@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
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
			`,
			{ '9@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
while (nrow(df) < 10) {
	if (ncol(df) == 1) {
		df <- cbind(df, runif(1))
		next
	}
	df <- rbind(df, c(6, "A"))
}
print(df)
			`,
			{ '9@df': { colnames: [['id'], Top], cols: [1, Infinity], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
while (ncol(df) < 2) {
	df <- cbind(df, name = "A")

	if (runif(1) < 0.5) {
		df <- rbind(df, c(6, "A"))
		next
	}
}
print(df)
			`,
			{ '10@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
while (nrow(df) < 10) {
	df <- rbind(df, 6)

	if (runif(1) < 0.5) {
		next
	}
	break
}
print(df)
			`,
			{ '10@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
while (TRUE) {
	df[2] <- 6:10
	break
}
df[10, ] <- c(6, 11)
print(df)
			`,
			{ '7@df': { colnames: [['id'], Top], cols: [1, 2], rows: [10, 10] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
repeat {
	df[2] <- 6:10
}
df[10, ] <- c(6, 11)
print(df)
			`,
			{ '6@df': undefined }, // unreachable
			{ skipRun: true }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
load('object_file')
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': undefined
			},
			{ skipRun: true }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
eval(parse(text="df <- 12"))
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': undefined
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = 6:10)
eval(parse(text="df$level <- df$score^2"))
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': undefined
			}
		);

		describe('Unsupported', { fails: true }, () => {
			testInferredDataFrameShape(
				shell,
				`
if (2 < 1) {
	df1 <- data.frame(id = 1:5)
} else {
	df2 <- data.frame(id = 1:5)
}
print(df1)
				`,
				['4@df']
			);
		});
	});

	describe('Create', () => {
		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95), check.names = FALSE)',
			{ '1@df': { colnames: [['id', 'age', 'score'], []], cols: [3, 3], rows: [5, 5] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame("id" = c(1, 2, 3, 5, 6, 7), `category` = c("A", "B", "A", "A", "B", "B"))',
			{ '1@df': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(1:5, c("A", "B", "C", "D", "E"), TRUE)',
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [5, 5] } }
		);

		testInferredDataFrameShape(
			shell,
			`
a = 1; b = "A"
df <- data.frame(id = c(a, a), name = b)
			`,
			{ '2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [2, 2] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(c(1, 2, 3:5, c(6, 7, c(8, 9))), c("a", "b", "c"))',
			{ '1@df': { colnames: [[], Top], cols: [2, 2], rows: [9, 9] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(1)',
			{ '1@df': { colnames: [[], Top], cols: [1, 1], rows: [1, 1] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame()',
			{ '1@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = c(), name = c())',
			{ '1@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = NULL)',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(data.frame(1:3))',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(list(id = 1:3))',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = list(num = 1:3, name = 3:1))',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(`:D` = 1:3)',
			{ '1@df': { colnames: [[], Top], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = 1:3, id = 4:6, name = c("A", "B", "C"))',
			{ '1@df': { colnames: [['name'], Top], cols: [3, 3], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(id = 1:3, name = 6:8, row.names = "id")',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(`:D` = 1:3, check.names = FALSE)',
			{ '1@df': { colnames: [[':D'], []], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- data.frame(1:3, fix.empty.names = FALSE)',
			{ '1@df': { colnames: [[], Top], cols: [1, 1], rows: [3, 3] } }
		);
	});

	describe('Convert', () => {
		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(data.frame(1:3))',
			{ '1@df': { colnames: [[], Top], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(list(id = 1:3))',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(c(1, 2, 3))',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(1)',
			{ '1@df': DataFrameTop }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:3, label = c("A", "B", "C"))
df2 <- as.data.frame(df1)
			`,
			{
				'1@df1': { colnames: [['id', 'label'], []], cols: [2, 2], rows: [3, 3] },
				'2@df2': { colnames: [['id', 'label'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), optional = TRUE)',
			{ '1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), cut.names = 3)',
			{ '1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), col.names = c("col1", "col2"))',
			{ '1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(data.frame(id = 1:3, name = 4:6), fix.empty.names = FALSE)',
			{ '1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- as.data.frame(optional = TRUE, fix.empty.names = FALSE, x = data.frame(id = 1:3, name = 4:6))',
			{ '1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);
	});

	describe('Read', () => {
		testInferredDataFrameShapeWithSource(
			shell,
			'"a.csv"', `text = "${getFileContent('a.csv')}"`,
			source => `df <- read.csv(${source})`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"a.csv"', `text = "${getFileContent('a.csv')}"`,
			source => `df <- read.csv(${source}, nrows = 1)`,
			{ '1@df': DataFrameTop },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"a.csv"', `text = "${getFileContent('a.csv')}"`,
			source => `df <- read.csv(${source}, nrows = -1)`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"a.csv"', `text = "${getFileContent('a.csv')}"`,
			source => `df <- read.table(${source}, header = TRUE, sep = ",")`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"b.csv"', `text = "${getFileContent('b.csv')}"`,
			source => `df <- read.csv(${source}, quote = "'")`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"b.csv"', `text = "${getFileContent('b.csv')}"`,
			source => `df <- read.table(${source}, header = TRUE, sep = ",")`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"c.csv"', `text = "${getFileContent('c.csv')}"`,
			source => `df <- read.csv(${source}, comment.char = "#", check.names = FALSE)`,
			{ '1@df': { colnames: [['', 'id,number', '"unique" name'], []], cols: [3, 3], rows: [5, 5] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"c.csv"', `text = "${getFileContent('c.csv')}"`,
			source => `df <- read.csv(${source}, header = FALSE, skip = 4)`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [5, 5] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `text = "${getFileContent('d.csv')}"`,
			source => `df <- read.csv2(${source}, header = FALSE)`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [4, 4] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `text = "${getFileContent('d.csv')}"`,
			source => `df <- read.delim(${source}, header = FALSE, sep = ",")`,
			{ '1@df': { colnames: [[], Top], cols: [2, 2], rows: [4, 4] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `text = "${getFileContent('d.csv')}"`,
			source => `df <- read.delim2(${source}, header = FALSE, sep = ";")`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [4, 4] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"e.csv"', `text = "${getFileContent('e.csv')}"`,
			source => `df <- read.table(${source}, header = TRUE)`,
			{ '1@df': { colnames: [['first', 'last', 'state', 'phone'], []], cols: [4, 4], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"f.csv"', `text = "${getFileContent('f.csv')}"`,
			source => `df <- read.delim(${source})`,
			{ '1@df': { colnames: [['state', 'phone'], Top], cols: [4, 4], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"g.csv"', `text = "${getFileContent('a.csv')}"`,
			source => `df <- read.csv(${source})`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"a.csv"', `"${getFileContent('a.csv')}"`,
			source => `df <- readr::read_csv(${source})`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"b.csv"', `"${getFileContent('b.csv')}"`,
			source => `df <- readr::read_csv(${source}, quote = "'")`,
			{ '1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"c.csv"', `"${getFileContent('c.csv')}"`,
			source => `df <- readr::read_csv(${source}, comment = "#")`,
			{ '1@df': { colnames: [['id,number', '"unique" name'], Top], cols: [3, 3], rows: [5, 5] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"c.csv"', `"${getFileContent('c.csv')}"`,
			source => `df <- readr::read_csv(${source}, col_names = FALSE, skip = 4)`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [5, 5] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `"${getFileContent('d.csv')}"`,
			source => `df <- readr::read_csv2(${source}, col_names = FALSE)`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [4, 4] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `"${getFileContent('d.csv')}"`,
			source => `df <- readr::read_delim(${source}, delim = ",", col_names = FALSE)`,
			{ '1@df': { colnames: [[], Top], cols: [2, 2], rows: [4, 4] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"d.csv"', `"${getFileContent('d.csv')}"`,
			source => `df <- readr::read_delim(${source}, delim = ";", col_names = FALSE)`,
			{ '1@df': { colnames: [[], Top], cols: [3, 3], rows: [4, 4] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"e.csv"', `"${getFileContent('e.csv')}"`,
			source => `df <- readr::read_table(${source})`,
			{ '1@df': { colnames: [['first', 'last', 'state', 'phone'], []], cols: [4, 4], rows: [3, 3] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);

		testInferredDataFrameShapeWithSource(
			shell,
			'"f.csv"', `"${getFileContent('f.csv')}"`,
			source => `df <- readr::read_tsv(${source})`,
			{ '1@df': { colnames: [['state', 'phone'], Top], cols: [4, 4], rows: [3, 3] } },
			{ skipRun: skipLibraries, files: sourceFiles }
		);
	});

	describe('Col/Row Access', () => {
		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6)
df$id
df$\`id\`
df$"id"
df$'id'
			`,
			{
				'2@$': [{ operation: 'accessCols', columns: ['id'] }],
				'3@$': [{ operation: 'accessCols', columns: ['id'] }],
				'4@$': [{ operation: 'accessCols', columns: ['id'] }],
				'5@$': [{ operation: 'accessCols', columns: ['id'] }]
			}
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6)
df["id"]
df[, "id"]
df[["id"]]
df[1]
df[, 1]
df[[1]]
df[1, ]
			`,
			{
				'2@[':  [{ operation: 'accessCols', columns: ['id'] }, { operation: 'subsetCols', colnames: ['id'] }],
				'3@[':  [{ operation: 'accessCols', columns: ['id'] }],
				'4@[[': [{ operation: 'accessCols', columns: ['id'] }],
				'5@[':  [{ operation: 'accessCols', columns: [1] }, { operation: 'subsetCols', colnames: [undefined] }],
				'6@[':  [{ operation: 'accessCols', columns: [1] }],
				'7@[[': [{ operation: 'accessCols', columns: [1] }],
				'8@[':  [{ operation: 'accessRows', rows: [1] }, { operation: 'subsetRows', rows: 1 }]
			}
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1, "id"]
df[[1, "id"]]
df[1, 1]
df[[1, 1]]
			`,
			{
				'2@[':  [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: ['id'] }],
				'3@[[': [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: ['id'] }],
				'4@[':  [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: [1] }],
				'5@[[': [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: [1] }]
			}
		);

		testMappedDataFrameOperations(
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
			`,
			{
				'2@[':  [{ operation: 'accessCols', columns: ['id', 'name'] }, { operation: 'subsetCols', colnames: ['id', 'name'] }],
				'3@[':  [{ operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetCols', colnames: [undefined, undefined] }],
				'4@[':  [{ operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetCols', colnames: [undefined, undefined] }],
				'5@[':  [{ operation: 'accessRows', rows: [1, 2] }, { operation: 'subsetRows', rows: 2 }],
				'6@[':  [{ operation: 'accessRows', rows: [1, 2] }, { operation: 'subsetRows', rows: 2 }],
				'7@[':  [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: ['id', 'name'] }, { operation: 'subsetRows', rows: 1 }, { operation: 'subsetCols', colnames: ['id', 'name'] }],
				'8@[':  [{ operation: 'accessRows', rows: [1] }, { operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetRows', rows: 1 }, { operation: 'subsetCols', colnames: [undefined, undefined] }],
				'9@[':  [{ operation: 'accessRows', rows: [1, 2] }, { operation: 'accessCols', columns: ['id'] }],
				'10@[': [{ operation: 'accessRows', rows: [1, 2] }, { operation: 'accessCols', columns: [1] }],
				'11@[': [{ operation: 'accessRows', rows: [1, 2] }, { operation: 'accessCols', columns: ['id', 'name'] }, { operation: 'subsetRows', rows: 2 }, { operation: 'subsetCols', colnames: ['id', 'name'] }],
				'12@[': [{ operation: 'accessRows', rows: [1, 3] }, { operation: 'accessCols', columns: [1, 2] }, { operation: 'subsetRows', rows: 2 }, { operation: 'subsetCols', colnames: [undefined, undefined] }]
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df["id"]
			`,
			{ '2@result': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1]
			`,
			{ '2@result': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, 1]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, 1]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [1, 1] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1, name = "A")
result <- df[, 1]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, c("id", "name")]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [1, 1] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1, c(1, 2)]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [1, 1] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1:2, c(1, 2)]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [2, 2] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, 1:2]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[1:2, ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [2, 2] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 2), 1]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[["id"]]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1]]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1, "id"]]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[[1, 1]]
			`,
			{ '2@result': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df["id", drop = TRUE]
			`,
			{ '2@result': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[, "id", drop = FALSE]
			`,
			{ '2@result': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[-1, "id", drop = FALSE]
			`,
			{ '2@result': { colnames: [['id'], []], cols: [1, 1], rows: [2, 2] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(-1, -2), -1, drop = FALSE]
			`,
			{ '2@result': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [1, 1] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[, -1]
			`,
			{ '2@result': { colnames: [[], ['id', 'name', 'score']], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1)]
			`,
			{ '2@result': { colnames: [[], ['id', 'name', 'score']], cols: [0, 3], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1), , drop = FALSE]
			`,
			{ '2@result': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [0, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[,]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0]
			`,
			{ '2@result': { colnames: [[], []], cols: [0, 0], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0, 1, drop = FALSE]
			`,
			{ '2@result': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [0, 0] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[0, 0]
			`,
			{ '2@result': { colnames: [[], []], cols: [0, 0], rows: [0, 0] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(TRUE, FALSE)]
			`,
			{ '2@result': { colnames: [[], ['id', 'name']], cols: [0, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[TRUE]
			`,
			{ '2@result': { colnames: [[], ['id', 'name']], cols: [0, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(TRUE, FALSE), ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[df$id == 2, ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[df$id == 2, "name", drop = FALSE]
			`,
			{ '2@result': { colnames: [['name'], []], cols: [1, 1], rows: [0, 3] } }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6)
df[["nam", exact = FALSE]]
			`,
			{ '2@[[': [{ operation: 'accessCols', columns: undefined }] }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c("id", "id")]
			`,
			{ '2@result': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1, 1)]
			`,
			{ '2@result': { colnames: [[], Top], cols: [3, 3], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1), ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [2, 2] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- df[c(1, 1, 1, 1, 1), ]
			`,
			{ '2@result': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] } }
		);

		testInferredDataFrameShape(
			shell,
			'result <- data.frame(id = 1:3, name = 4:6)["id"]',
			{ '1@result': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'result <- cbind(data.frame(id = 1:3), name = 4:6)[2]',
			{ '1@result': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [3, 3] } }
		);

		describe('Unsupported', { fails: true }, () => {
			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3)
result <- df[1, ]
				`,
				['2@result']
			);

			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[sample(1:3, 1), sample(1:3, 1)]
				`,
				['2@result']
			);

			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[rep("id", times = 12)]
				`,
				['2@result']
			);

			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- df[rep(1, times = 12), ]
				`,
				['2@result']
			);
		});
	});

	describe('Col/Row Assignment', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df$id <- 4:6
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df$\`name\` <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df$"name" <- letters[1:3]
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df$name <- NULL
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df$name[3] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df$name[[3]] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df["id"] <- 4:6
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[["name"]] <- letters[1:3]
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[1] <- c("A", "B", "C")
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[[2]] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[, "name"] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, ] <- 4
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, "id"] <- 4
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[[4, "id"]] <- 4
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[4, 1] <- 4
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[[4, 1]] <- 4
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1, c("id", "name")] <- c(42, "A")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, c("score", "level")] <- 100
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name', 'score', 'level'], []], cols: [4, 4], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[4, c(1, 2)] <- 100
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1:2, c(1, 3)] <- 1
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[3:5, 1:3] <- 1
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, 1:3] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[1:8, ] <- 0
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [8, 8] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(1, 4), 1] <- 42
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [4, 4] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[-1, "id"] <- 8:9
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(-1, -2), -1] <- 1
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[, -5] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[sample(1:10)] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [2, Infinity], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[sample(1:10), ] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[] <- NULL
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], []], cols: [0, 0], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[,] <- 0
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
df[c("name", "score")] <- NULL
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[2] <- NULL
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], ['id', 'name']], cols: [1, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(TRUE, FALSE)] <- 3:1
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [2, Infinity], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[TRUE] <- 42
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], Top], cols: [2, Infinity], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[c(TRUE, FALSE), ] <- 1
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df[df$id == 2, ] <- c(5, "A")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[["name"]][3] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df[[1]][3] <- "A"
print(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'3@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		describe('Unsupported', { fails: true }, () => {
			testInferredDataFrameShape(
				shell,
				`
null <- \\() NULL
df <- data.frame(id = 1:3, name = 4:6)
df$name <- null()
print(df)
				`,
				['4@df'],
				{ minRVersion: MIN_VERSION_LAMBDA }
			);

			testInferredDataFrameShape(
				shell,
				`
null <- \\() NULL
df <- data.frame(id = 1:3, name = 4:6)
df["name"] <- null()
print(df)
				`,
				['4@df'],
				{ minRVersion: MIN_VERSION_LAMBDA }
			);

			testInferredDataFrameShape(
				shell,
				`
null <- \\() NULL
df <- data.frame(id = 1:3, name = 4:6)
df[[1]] <- null()
print(df)
				`,
				['4@df'],
				{ minRVersion: MIN_VERSION_LAMBDA }
			);
		});
	});

	describe('Set Names', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(1:5, 6:10)
colnames(df) <- c("id", "name")
print(df)
			`,
			{
				'1@df': { colnames: [[], Top], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(1:5, 6:10)
names(df) <- c("id", "name")
print(df)
			`,
			{
				'1@df': { colnames: [[], Top], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- runif(2)
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- NULL
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df) <- "col"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [['col'], Top], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10, score = 11:15)
colnames(df) <- c("col1", "col2")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'3@df': { colnames: [['col1', 'col2'], Top], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df)[1] <- "test"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [['test'], ['id', 'name']], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10, score = 11:15)
colnames(df)[1:2] <- "test"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'3@df': { colnames: [['test'], ['id', 'name', 'score']], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
colnames(df)[-1] <- "test"
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'3@df': { colnames: [['test'], ['id', 'name']], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
rownames(df) <- c("row1", "row2", "row3")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
rownames(df) <- runif(3)
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df) <- list(c("row1", "row2", "row3"), c("col1", "col2"))
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[[1]] <- c("row1", "row2", "row3")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[[2]] <- c("col1", "col2")
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[1:2] <- list(c("row1", "row2", "row3"), c("col1", "col2"))
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
dimnames(df)[-1] <- list(c("col1", "col2"))
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'3@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);
	});

	describe('Col/Row Bind', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, name = 6:10, label = c("A", "B", "C", "D", "E"))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, 6:10, c("A", "B", "C", "D", "E"))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], Top], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, name = "A")
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, runif(5))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], Top], cols: [1, Infinity], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:5)
df2 <- data.frame(name = 6:10)
df3 <- data.frame(label = c("A", "B", "C", "D", "E"))
df <- cbind(df1, df2, df3)
			`,
			{
				'1@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df2': { colnames: [['name'], []], cols: [1, 1], rows: [5, 5] },
				'3@df3': { colnames: [['label'], []], cols: [1, 1], rows: [5, 5] },
				'4@df':  { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:5)
df2 <- data.frame(name = 6:10)
df <- cbind(df1, df2, label = c("A", "B", "C", "D", "E"))
			`,
			{
				'1@df1': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df2': { colnames: [['name'], []], cols: [1, 1], rows: [5, 5] },
				'3@df':  { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df, label = list(name = 6:10))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], Top], cols: [1, Infinity], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- cbind(6:10, df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], Top], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			'df <- cbind(name = c("A", "B", "C"), value = "X", data.frame(id = 1:3, score = c(90, 75, 80)))',
			{ '1@df': { colnames: [['name', 'value', 'id', 'score'], []], cols: [4, 4], rows: [3, 3] } }
		);

		testInferredDataFrameShape(
			shell,
			'df <- cbind(id = 1:3, name = 4:6)',
			{ '1@df': undefined }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1, name = "A", score = 20)
df <- rbind(df, c(2, "B", 30), c(4, "C", 25))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [1, 1] },
				'2@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 6:8)
df <- rbind(df, row4 = c(4, 9), row5 = c(5, 10))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, 6, 7, 8, 9, 10)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [10, 10] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, runif(5))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:3, name = c("A", "B", "C"), score = c(20, 30, 25))
df2 <- data.frame(id = 4, name = "D", score = 20)
df3 <- data.frame(id = 5, name = "E", score = 40)
df <- rbind(df1, df2, df3)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] },
				'2@df2': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [1, 1] },
				'3@df3': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [1, 1] },
				'4@df':  { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:3, name = c("A", "B", "C"), score = c(20, 30, 25))
df2 <- data.frame(id = 4, name = "D", score = 20)
df <- rbind(df1, df2, label = c(5, "E", 40))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [3, 3] },
				'2@df2': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [1, 1] },
				'3@df':  { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df, list(id = 6:10))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- rbind(6, df)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			'df <- rbind(1:2, "X", data.frame(id = 1:3, score = c(90, 75, 80)), c("A", "B"))',
			{ '1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [6, 6] } }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame()
df <- rbind(df, data.frame(id = 1:5, name = "A"))
			`,
			{
				'1@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [0, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = c(), name = c())
df <- rbind(df, data.frame(score = 1:5, age = "A"))
			`,
			{
				'1@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] },
				'2@df': { colnames: [[], ['score', 'age']], cols: [0, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame()
df <- rbind(df, 12)
			`,
			{
				'1@df': { colnames: [[], []], cols: [0, 0], rows: [0, 0] },
				'2@df': { colnames: [[], Top], cols: [1, 1], rows: [1, 1] }
			}
		);

		testInferredDataFrameShape(
			shell,
			'df <- rbind(1:3, 4:6)',
			{ '1@df': undefined }
		);
	});

	describe('Head/Tail', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = 12)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [12, 12] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- head(df, n = 12)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- head(df, n = 3)
			`,
			{
				'1@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [3, 5] },
				'2@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, c(2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [2, 2] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(n = -2, x = df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [48, 48] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = -c(2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [48, 48] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, n = c(-2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [48, 48] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- head(df, sample(1:50, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 50] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = 12)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [12, 12] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = 12)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- if (runif(1) >= 0.5) data.frame(id = 1:3) else data.frame(id = 1:5, name = 6:10)
df <- tail(df, n = 3)
			`,
			{
				'1@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [3, 5] },
				'2@df': { colnames: [['id'], ['name']], cols: [1, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, c(2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [2, 2] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(n = -2, x = df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [48, 48] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = -c(2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [48, 48] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, n = c(-2, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [[], ['id', 'name']], cols: [1, 1], rows: [48, 48] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:50, name = 51:100)
df <- tail(df, sample(1:50, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [50, 50] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 50] }
			},
			{ minRVersion: MIN_VERSION_HEAD_TAIL_VECTOR }
		);
	});

	describe('Subset', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, FALSE)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [0, 0] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id > 1)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [0, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, c(TRUE, FALSE))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [0, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = "id")
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = 1)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, label))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'label'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c("id", "name"))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = 1:2)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, 2))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3)
df <- subset(df, select = c(id, 1))
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] },
				'2@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id:name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = sample(1:3, 2))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE, select = c(id, name))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, FALSE, id)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [0, 0] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id == 2, -label)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, id > 1, select = c(-name, -label))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [0, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -c(id, name))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['label'], []], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -c(1, 2))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [1, 1], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = -1)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [2, 2], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(TRUE, FALSE))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, TRUE, TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, id))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], Top], cols: [2, 2], rows: [3, 3] }
			}
		);
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(1, 1, 1))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], Top], cols: [3, 3], rows: [3, 3] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = id, drop = TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': undefined
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- subset(df, select = c(id, name), drop = TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			}
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, id > 1, c("name", "label"))
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: ['id', 'name', 'label'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, label != "A", -id)
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: ['id', 'label'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, select = 1:2)
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: [1, 2] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, id > 1, c("name", "label"))
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: ['id', 'name', 'label'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, label != "A", -id)
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: ['id', 'label'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, select = 1:2)
			`,
			{ '2@subset': [{ operation: 'accessCols', columns: [1, 2] }] }
		);

		describe('Unsupported', { fails: true }, () => {
			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, select = rep("id", times = 12))
				`,
				['2@result']
			);

			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- subset(df, select = -c(3, 4, 5))
				`,
				['2@result']
			);

			testInferredDataFrameShape(
				shell,
				`
df <- data.frame(id = 1:3, name = 4:6, score = 7:9)
result <- subset(TRUE, FALSE, x = df)
				`,
				['2@result']
			);
		});
	});

	describe('Filter', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, FALSE)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 0] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, id == 2)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, TRUE, TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, TRUE, FALSE, TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 0] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6)
df <- dplyr::filter(df, FALSE, .preserve = TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [0, 0] }
			},
			{ skipRun: skipLibraries }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6)
result <- dplyr::filter(df, id != 2, is.numeric(name))
			`,
			{ '2@filter': [{ operation: 'accessCols', columns: ['id', 'name'] }] }
		);
	});

	describe('Select', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, "id", "name")
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1, 3)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(id, name))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c("id", "name"))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1:2)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id:name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, sample(1:3, 2))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], []], cols: [0, 0], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id', 'label'], []], cols: [2, 2], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -name, -label)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, -name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(-id, -name))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['label'], []], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -c(id, name))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [['label'], []], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, -c(1, 2))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, "name", -2)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, nr = id)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], Top], cols: [1, 1], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id, \`id\`, "id")
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, 1, 1, 1)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, !name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, id | 2)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, c(id, name) & 1:3)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
df <- dplyr::select(df, contains("a"))
			`,
			{
				'1@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [3, 3] },
				'2@df': { colnames: [[], ['id', 'name', 'label']], cols: [0, 3], rows: [3, 3] }
			},
			{ skipRun: skipLibraries }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- dplyr::select(df, c("id", "name"))
			`,
			{ '2@select': [{ operation: 'accessCols', columns: ['id', 'name'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- dplyr::select(df, id, -label)
			`,
			{ '2@select': [{ operation: 'accessCols', columns: ['id', 'label'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:3, name = 4:6, label = "A")
result <- dplyr::select(df, 1:2)
			`,
			{ '2@select': [{ operation: 'accessCols', columns: [1, 2] }] }
		);
	});

	describe('Transform', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- transform(df, id = letters[1:5])
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- transform(df, "name" = letters[1:5])
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- transform(df, name = letters[id], level = score^2)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score', 'name', 'level'], []], cols: [4, 4], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, \`:D\` = 11:15)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], Top], cols: [2, 3], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, score = 31:35, \`score\` = 36:40)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], Top], cols: [2, 4], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, name = NULL)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, "A")
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], Top], cols: [2, 3], rows: [5, 5] }
			}
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- transform(df, name = letters[id], level = score^2)
			`,
			{ '2@transform': [{ operation: 'accessCols', columns: ['id', 'score'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, score = id, level = score / max(score))
			`,
			{ '2@transform': [{ operation: 'accessCols', columns: ['id'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- transform(df, name = letters[id], level = score^2)
			`,
			{ '2@transform': [{ operation: 'accessCols', columns: ['id', 'score'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- transform(df, score = id, level = score / max(score))
			`,
			{ '2@transform': [{ operation: 'accessCols', columns: ['id'] }] }
		);
	});

	describe('Mutate', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, id = letters[1:5])
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, "name" = letters[1:5])
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5)
df <- dplyr::mutate(df, 6:10, 11:15)
			`,
			{
				'1@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] },
				'2@df': { colnames: [['id'], Top], cols: [2, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- dplyr::mutate(df, name = letters[id], level = score^2)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score', 'name', 'level'], []], cols: [4, 4], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, \`:D\` = 11:15)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', ':D'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, score = 31:35, \`score\` = 36:40)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, name = NULL)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id'], []], cols: [1, 1], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, new = NULL)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, new = -id, new = NULL)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, label = "A", .before = NULL)
			`,
			{
				'1@df': { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'label'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- dplyr::mutate(df, name = letters[id], level = score^2)
			`,
			{ '2@mutate': [{ operation: 'accessCols', columns: ['id', 'score'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, name = 6:10)
df <- dplyr::mutate(df, score = id, level = score / max(score))
			`,
			{ '2@mutate': [{ operation: 'accessCols', columns: ['id'] }] }
		);
	});

	describe('Group By', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, \`id\`)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = c("A", "A", "B", "A", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id, name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id + name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'score'], Top], cols: [3, 4], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, name = 6:10, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, group = id + name)
			`,
			{
				'1@df': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'name', 'score', 'group'], []], cols: [4, 4], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id, .add = TRUE)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, mean = mean(score), sum = sum(score))
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'2@df': { colnames: [['mean', 'sum'], ['id', 'category', 'score']], cols: [2, 5], rows: [1, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, category) |> summarize(mean = mean(score), sum = sum(score))
			`,
			{
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'3@df': { colnames: [['mean', 'sum'], ['id', 'category', 'score']], cols: [2, 5], rows: [1, 6] }
			},
			{ skipRun: skipLibraries, minRVersion: MIN_VERSION_PIPE }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, id, category) |> summarize(mean = mean(score), sum = sum(score))
			`,
			{
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'3@df': { colnames: [['mean', 'sum'], ['id', 'category', 'score']], cols: [2, 5], rows: [1, 6] }
			},
			{ skipRun: skipLibraries, minRVersion: MIN_VERSION_PIPE }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, 1)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'2@df': { colnames: [[], Top], cols: [1, 4], rows: [1, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'2@df': { colnames: [[], ['id', 'category', 'score']], cols: [0, 3], rows: [1, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- group_by(df, category) |> summarize()
			`,
			{
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'3@df': { colnames: [[], ['id', 'category', 'score']], cols: [0, 3], rows: [1, 6] }
			},
			{ skipRun: skipLibraries, minRVersion: MIN_VERSION_PIPE }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, mean = mean(score), sum = sum(score), .groups = "drop")
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'2@df': { colnames: [['mean', 'sum'], ['id', 'category', 'score']], cols: [2, 5], rows: [1, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- filter(df, FALSE) |> group_by(category) |> summarize(score = mean(score))
			`,
			{
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'3@df': { colnames: [['score'], ['id', 'category']], cols: [1, 3], rows: [0, 1] }
			},
			{ skipRun: skipLibraries, minRVersion: MIN_VERSION_PIPE }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- filter(df, FALSE) |> summarize(score = mean(score))
			`,
			{
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] },
				'3@df': { colnames: [['score'], ['id', 'category']], cols: [1, 3], rows: [0, 1] }
			},
			{ skipRun: skipLibraries, minRVersion: MIN_VERSION_PIPE }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:5, name = c("A", "A", "B", "A", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::group_by(df, id, name)
			`,
			{ '2@group_by': [{ operation: 'accessCols', columns: ['id', 'name'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, name = letters[id], level = score / max(score))
			`,
			{ '2@summarize': [{ operation: 'accessCols', columns: ['id', 'score'] }] }
		);

		testMappedDataFrameOperations(
			`
df <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85, 82))
df <- dplyr::summarize(df, level = score / max(score), sum = sum(level))
			`,
			{ '2@summarize': [{ operation: 'accessCols', columns: ['score'] }] }
		);
	});

	describe('Join', () => {
		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::inner_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- dplyr::inner_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, category = c("A", "B", "C", "A"))
df2 <- data.frame(id = c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), score = 80)
df <- dplyr::inner_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [10, 10] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [0, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, by = c("id", "name"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, list(x = "id", y = "nr"))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [0, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, dplyr::join_by(id == nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [0, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, dplyr::join_by(score >= level))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [0, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 5:10, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, dplyr::join_by(id <= nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [0, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, "id", suffix = c(".df1", ".df2"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, "id", keep = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  DataFrameTop
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "X", category = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "Y", category = c("A", "B", "B", "A", "C", "B"), amount = 16)
df <- dplyr::inner_join(df1, df2, by = sample(colnames(df1)[1:3], 2))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'category', 'score'], []], cols: [4, 4], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category', 'amount'], []], cols: [4, 4], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [4, 8], rows: [0, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::left_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- dplyr::left_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, category = c("A", "B", "C", "A"))
df2 <- data.frame(id = c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), score = 80)
df <- dplyr::left_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [10, 10] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [4, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, by = c("id", "name"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, list(x = "id", y = "nr"))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [4, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, dplyr::join_by(id == nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [4, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, dplyr::join_by(score >= level))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [4, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 5:10, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, dplyr::join_by(id <= nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [4, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id", suffix = c(".df1", ".df2"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, "id", keep = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  DataFrameTop
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "X", category = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "Y", category = c("A", "B", "B", "A", "C", "B"), amount = 16)
df <- dplyr::left_join(df1, df2, by = sample(colnames(df1)[1:3], 2))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'category', 'score'], []], cols: [4, 4], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category', 'amount'], []], cols: [4, 4], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [4, 8], rows: [4, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::right_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- dplyr::right_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [4, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, category = c("A", "B", "C", "A"))
df2 <- data.frame(id = c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), score = 80)
df <- dplyr::right_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [10, 10] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [10, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, by = c("id", "name"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, list(x = "id", y = "nr"))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, dplyr::join_by(id == nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, dplyr::join_by(score >= level))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 5:10, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, dplyr::join_by(id <= nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, "id", suffix = c(".df1", ".df2"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [6, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, "id", keep = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  DataFrameTop
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "X", category = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "Y", category = c("A", "B", "B", "A", "C", "B"), amount = 16)
df <- dplyr::right_join(df1, df2, by = sample(colnames(df1)[1:3], 2))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'category', 'score'], []], cols: [4, 4], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category', 'amount'], []], cols: [4, 4], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [4, 8], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- dplyr::full_join(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- dplyr::full_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, category = c("A", "B", "C", "A"))
df2 <- data.frame(id = c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), score = 80)
df <- dplyr::full_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [10, 10] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [10, 14] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, by = c("id", "name"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, list(x = "id", y = "nr"))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, dplyr::join_by(id == nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [2, 4], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, dplyr::join_by(score >= level))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 5:10, level = 80, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, dplyr::join_by(id <= nr))
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'level', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 5], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, "id", suffix = c(".df1", ".df2"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [6, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, "id", keep = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  DataFrameTop
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "X", category = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "Y", category = c("A", "B", "B", "A", "C", "B"), amount = 16)
df <- dplyr::full_join(df1, df2, by = sample(colnames(df1)[1:3], 2))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'category', 'score'], []], cols: [4, 4], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category', 'amount'], []], cols: [4, 4], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [4, 8], rows: [6, 24] }
			},
			{ skipRun: skipLibraries }
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::inner_join(df1, df2, by = "id")
			`,
			{ '3@inner_join': [{ operation: 'accessCols', columns: ['id'] }] }
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::left_join(df1, df2, by = "id")
			`,
			{ '3@left_join': [{ operation: 'accessCols', columns: ['id'] }] }
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::right_join(df1, df2, by = "id")
			`,
			{ '3@right_join': [{ operation: 'accessCols', columns: ['id'] }] }
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- dplyr::full_join(df1, df2, by = "id")
			`,
			{ '3@full_join': [{ operation: 'accessCols', columns: ['id'] }] }
		);
	});

	describe('Merge', () => {
		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- merge(df1, df2, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- merge(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, 1)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [3, 3], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c("id", "name"))
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = 1:2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [[], Top], cols: [4, 4], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'name', 'score', 'category'], []], cols: [4, 4], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['name', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'name', 'category'], []], cols: [4, 4], rows: [0, 24] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c())
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['score', 'category'], Top], cols: [4, 4], rows: [0, 24] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
lst <- list(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, lst, by = "id")
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id'], Top], cols: [1, Infinity], rows: [0, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, category = c("A", "B", "C", "A"))
df2 <- data.frame(id = c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), score = 80)
df <- merge(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [10, 10] },
				'3@df':  { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [0, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
lst <- list(id = 3:8, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, lst, by = "id", all = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id'], Top], cols: [1, Infinity], rows: [4, Infinity] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [0, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(nr = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by.x = "id", by.y = "nr")
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['nr', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  DataFrameTop
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df <- merge(df1, df2, "id", all.x = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 5:8, score = c(80, 75, 90, 70))
df <- merge(df1, df2, "id", all.x = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df2 <- data.frame(id = 7:10, score = c(80, 75, 90, 70))
df <- merge(df1, df2, "id", all.x = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'2@df2': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all.y = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 3:8, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all.y = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all.y = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 6] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all = runif(1) >= 0.5)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  DataFrameTop
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 10] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 3:8, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 10] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, score = c(80, 75, 90, 70))
df2 <- data.frame(id = 5:10, category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", all = TRUE)
			`,
			{
				'1@df1': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], []], cols: [3, 3], rows: [6, 10] }
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "B", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, "id", no.dups = FALSE)
			`,
			{
				'1@df1': { colnames: [['id', 'name', 'score'], []], cols: [3, 3], rows: [4, 4] },
				'2@df2': { colnames: [['id', 'name', 'category'], []], cols: [3, 3], rows: [6, 6] },
				'3@df':  { colnames: [['id', 'score', 'category'], Top], cols: [5, 5], rows: [0, 6] }
			}
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c("id", "name"))
			`,
			{ '3@merge': [{ operation: 'accessCols', columns: ['id', 'name'] }] }
		);

		testMappedDataFrameOperations(
			`
df1 <- data.frame(id = 1:4, name = "A", score = c(80, 75, 90, 70))
df2 <- data.frame(id = 1:6, name = "A", category = c("A", "B", "B", "A", "C", "B"))
df <- merge(df1, df2, by = c("id", "name"))
			`,
			{ '3@merge': [{ operation: 'accessCols', columns: ['id', 'name'] }] }
		);
	});

	describe('Rearrange', () => {
		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, category)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, score, .before = category)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::relocate(df, label = category)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': DataFrameTop
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::arrange(df, -score, id)
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, category = c("A", "B", "A", "C", "B"), score = c(80, 75, 90, 70, 85))
df <- dplyr::arrange(df, desc(score))
			`,
			{
				'1@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'2@df': { colnames: [['id', 'category', 'score'], []], cols: [3, 3], rows: [5, 5] }
			},
			{ skipRun: skipLibraries }
		);
	});

	describe('Other', () => {
		testInferredDataFrameShape(
			shell,
			'df <- dplyr::tibble(id = 1:5, age = c(25, 32, 35, 40, 45), score = c(90, 85, 88, 92, 95))',
			{ '1@df': DataFrameTop },
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = c(1, 2, 3, 1, 3), score = c(80, 75, 90, 70, 85))
df <- aggregate(df, list(group = df$id), mean)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'2@df': DataFrameTop
			}
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:5, score = 31:35)
df <- within(df, {
    name <- letters[id]
	level <- score^2
})
print(df)
			`,
			{
				'1@df': { colnames: [['id', 'score'], []], cols: [2, 2], rows: [5, 5] },
				'6@df': DataFrameTop
			}
		);
	});

	describe('General', () => {
		testInferredDataFrameShape(
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
			`,
			{
				'3@df1':  { colnames: [['id', 'age', 'score'], []], cols: [3, 3], rows: [5, 5] },
				'4@df2':  { colnames: [['id', 'category'], []], cols: [2, 2], rows: [6, 6] },
				'11@df3': { colnames: [['id', 'score', 'level', 'category'], []], cols: [4, 4], rows: [0, 6] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
library(dplyr)

df <- data.frame(
    id = 1:10,
    name = c("Alice", "Bob", "Charlie", "David", "Eva", "Frank", "Grace", "Hannah", "Ian", "Jack"),
    age = c(23, 30, 22, 35, 28, 40, 29, 31, 24, 27),
    score = c(85, 90, 78, 88, 92, 95, 80, 75, 89, 84)
)

result <- df %>% select(-name)
result <- result %>% filter(age > 25)
result <- result %>% group_by(age)
result <- result %>% summarize(avg_score = mean(score))
result <- result %>% mutate(grade = ifelse(avg_score >= 90, "Excellent", ifelse(avg_score >= 80, "Good", "Average")))
result <- result %>% arrange(desc(avg_score))
			`,
			{
				'10@df':     { colnames: [['id', 'name', 'age', 'score'], []], cols: [4, 4], rows: [10, 10] },
				'10@result': { colnames: [['id', 'age', 'score'], []], cols: [3, 3], rows: [10, 10] },
				'11@result': { colnames: [['id', 'age', 'score'], []], cols: [3, 3], rows: [0, 10] },
				'12@result': { colnames: [['id', 'age', 'score'], []], cols: [3, 3], rows: [0, 10] },
				'13@result': { colnames: [['avg_score'], ['id', 'age', 'score']], cols: [1, 4], rows: [0, 10] },
				'14@result': { colnames: [['avg_score', 'grade'], ['id', 'age', 'score']], cols: [2, 5], rows: [0, 10] },
				'15@result': { colnames: [['avg_score', 'grade'], ['id', 'age', 'score']], cols: [2, 5], rows: [0, 10] }
			},
			{ skipRun: skipLibraries }
		);

		testInferredDataFrameShape(
			shell,
			`
df <- data.frame(id = 1:3, age = c(25, 30, 40))
df <- df |> subset(age < 30)
df <- df |> rbind(c(4, 32), c(5, 35))
df <- df[2:3, 1:2]
			`,
			{
				'1@df': { colnames: [['id', 'age'], []], cols: [2, 2], rows: [3, 3] },
				'2@df': { colnames: [['id', 'age'], []], cols: [2, 2], rows: [0, 3] },
				'3@df': { colnames: [['id', 'age'], []], cols: [2, 2], rows: [2, 5] },
				'4@df': { colnames: [['id', 'age'], []], cols: [2, 2], rows: [2, 2] },
			},
			{ minRVersion: MIN_VERSION_PIPE }
		);
	});
}));
