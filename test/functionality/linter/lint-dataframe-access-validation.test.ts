import { describe } from 'vitest';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import type { DataFrameAccessValidationResult } from '../../../src/linter/rules/dataframe-access-validation';
import { rangeFrom } from '../../../src/util/range';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';

describe('flowR linter', withTreeSitter(parser => {
	describe('Data frame access validation', () => {
		interface ExampleCodeParams {
			filter?: string;
			mutate?: string;
			join?:   string;
			select?: string | number;
			access?: `$${string}` | `[${string}]` | `[[${string}]]`;
		}

		function exampleCode(params: ExampleCodeParams) {
			const { filter, mutate, join, select, access } = { filter: 'age', mutate: 'score', join: 'id', select: 'age', access: '$level', ...params };
			return `
library(dplyr)

df1 <- data.frame(
    id = 1:5,
    age = c(25, 32, 35, 40, 45),
    score = c(90, 85, 88, 92, 95)
)
df2 <- data.frame(
    id = c(1, 2, 3, 5, 6, 7),
    category = c("A", "B", "A", "A", "B", "B")
)
df3 <- df1 %>%
    filter(${filter} > 30) %>%
    mutate(level = ${mutate}^2) %>%
    left_join(df2, by = "${join}") %>%
    select(-${select})

print(df3${access})
			`.trim();
		};

		describe('Valid data frame access', () => {
			const testCases: string[] = [
				'df <- data.frame(id = 1:5, name = "A")\ndf$id',
				'df <- data.frame(id = 1:5, name = "A")\ndf["id"]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[["name"]]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[[2]]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[1:2]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[-2]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[5, ]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[0]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[[5, 2]]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[3, "id"]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[1:5, c(1, 2)]',
				'df <- data.frame(id = 1:5, name = "A")\ndf[-c(1, 2), ]',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, id > 2)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = id)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 2)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = c(id, name))',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::filter(df, id > 2)',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, id, name)',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, 2, 1)',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, c(id, name))',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, 1:2)',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, id:name)',
				'df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, id, -name)',
				'df <- data.frame(id = 1:5, level = 6:10)\ndplyr::mutate(df, label = "A")',
				'df <- data.frame(id = 1:5, level = 6:10)\ndplyr::mutate(df, id = 100 + id, score = level^2)',
				'df <- data.frame(id = 1:5, level = 6:10)\ndplyr::mutate(df, score = level^2, double = 2*score)',
				'df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8))\nmerge(df1, df2, by = "id")',
				'df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8, name = "B")\nmerge(df1, df2, by = c("id", "name"))',
				exampleCode({}),
				exampleCode({ filter: 'score' }),
				exampleCode({ mutate: 'age' }),
				exampleCode({ join: 'id' }),
				exampleCode({ select: 'id' }),
				exampleCode({ select: 2 }),
				exampleCode({ access: '$category' }),
				exampleCode({ access: '[, "level"]' }),
				exampleCode({ access: '[["level"]]' }),
				exampleCode({ access: '[4]' }),
				exampleCode({ access: '[[1]]' }),
				exampleCode({ access: '[1, ]' }),
				exampleCode({ access: '[5, 4]' }),
				exampleCode({ access: '[3:4]' }),
				exampleCode({ access: '[3:5, c(1, 3)]' })
			];

			for(const test of testCases) {
				/* @ignore-in-wiki */
				assertLinter(test, parser, test, 'dataframe-access-validation', []);
			}
		});
		describe('Invalid data frame access', () => {
			type ExpectedLinterResult = Omit<DataFrameAccessValidationResult, 'certainty' | 'quickFix' | 'involvedId'>;

			const testCases: [string, ExpectedLinterResult][] = [
				['df <- data.frame(id = 1:5, name = "A")\ndf$score', { type: 'column', accessed: 'score', access: '$', operand: 'df', range: rangeFrom(2, 1, 2, 8) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf["level"]', { type: 'column', accessed: 'level', access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 11) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[["type"]]', { type: 'column', accessed: 'type', access: '[[', operand: 'df', range: rangeFrom(2, 1, 2, 12) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[[4]]', { type: 'column', accessed: 4, access: '[[', operand: 'df', range: rangeFrom(2, 1, 2, 7) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[2:3]', { type: 'column', accessed: 3, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 7) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[-3]', { type: 'column', accessed: 3, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 6) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[7, ]', { type: 'row', accessed: 7, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 7) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[c(1, 3)]', { type: 'column', accessed: 3, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 11) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[c(4, 8), ]', { type: 'row', accessed: 8, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 13) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[[5, 4]]', { type: 'column', accessed: 4, access: '[[', operand: 'df', range: rangeFrom(2, 1, 2, 10) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[[6, 2]]', { type: 'row', accessed: 6, access: '[[', operand: 'df', range: rangeFrom(2, 1, 2, 10) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[3, "score"]', { type: 'column', accessed: 'score', access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 14) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[1:5, c(1, 3)]', { type: 'column', accessed: 3, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 16) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[1:6, c(1, 2)]', { type: 'row', accessed: 6, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 16) }],
				['df <- data.frame(id = 1:5, name = "A")\ndf[-c(4, 6), ]', { type: 'row', accessed: 6, access: '[', operand: 'df', range: rangeFrom(2, 1, 2, 14) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, score > 50)', { type: 'column', accessed: 'score', access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 22) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = score)', { type: 'column', accessed: 'score', access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 26) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 4)', { type: 'column', accessed: 4, access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 22) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = c(id, score))', { type: 'column', accessed: 'score', access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 33) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::filter(df, age > 30)', { type: 'column', accessed: 'age', access: 'dplyr::filter', operand: 'df', range: rangeFrom(2, 1, 2, 27) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, id, score)', { type: 'column', accessed: 'score', access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 28) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, 2, 4)', { type: 'column', accessed: 4, access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 23) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, c(id, score))', { type: 'column', accessed: 'score', access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 31) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, 2:3)', { type: 'column', accessed: 3, access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 22) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, c(1, 4))', { type: 'column', accessed: 4, access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 26) }],
				['df <- data.frame(id = 1:5, name = "A")\ndplyr::select(df, id, -level)', { type: 'column', accessed: 'level', access: 'dplyr::select', operand: 'df', range: rangeFrom(2, 1, 2, 29) }],
				['df <- data.frame(id = 1:5, level = 6:10)\ndplyr::mutate(df, score = value^2)', { type: 'column', accessed: 'value', access: 'dplyr::mutate', operand: 'df', range: rangeFrom(2, 1, 2, 34) }],
				['df <- data.frame(id = 1:5, level = 6:10)\ndplyr::mutate(df, avg = mean(age), score = level^2)', { type: 'column', accessed: 'age', access: 'dplyr::mutate', operand: 'df', range: rangeFrom(2, 1, 2, 51) }],
				['df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8)\nmerge(df1, df2, by = "key")', { type: 'column', accessed: 'key', access: 'merge', operand: 'df1', range: rangeFrom(3, 1, 3, 27) }],
				['df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8, name = "B")\nmerge(df1, df2, by = c("id", "type"))', { type: 'column', accessed: 'type', access: 'merge', operand: 'df1', range: rangeFrom(3, 1, 3, 37) }],
				[exampleCode({ filter: 'skill' }), { type: 'column', accessed: 'skill', access: 'filter', operand: 'df1', range: rangeFrom(13, 5, 13, 22) }],
				[exampleCode({ mutate: 'value' }), { type: 'column', accessed: 'value', access: 'mutate', range: rangeFrom(14, 5, 14, 27) }],
				[exampleCode({ join: 'key' }), { type: 'column', accessed: 'key', access: 'left_join', range: rangeFrom(15, 5, 15, 30) }],
				[exampleCode({ select: 'name' }), { type: 'column', accessed: 'name', access: 'select', range: rangeFrom(16, 5, 16, 17) }],
				[exampleCode({ select: 6 }), { type: 'column', accessed: 6, access: 'select', range: rangeFrom(16, 5, 16, 14) }],
				[exampleCode({ access: '$age' }), { type: 'column', accessed: 'age', access: '$', operand: 'df3', range: rangeFrom(18, 7, 18, 13) }],
				[exampleCode({ access: '[, "skill"]' }), { type: 'column', accessed: 'skill', access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 20) }],
				[exampleCode({ access: '[["name"]]' }), { type: 'column', accessed: 'name', access: '[[', operand: 'df3', range: rangeFrom(18, 7, 18, 19) }],
				[exampleCode({ access: '[5]' }), { type: 'column', accessed: 5, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 12) }],
				[exampleCode({ access: '[[12]]' }), { type: 'column', accessed: 12, access: '[[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[7, ]' }), { type: 'row', accessed: 7, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 14) }],
				[exampleCode({ access: '[5, 6]' }), { type: 'column', accessed: 6, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[8, 4]' }), { type: 'row', accessed: 8, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[3:5]' }), { type: 'column', accessed: 5, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 14) }],
				[exampleCode({ access: '[3:5, c(2, 8)]' }), { type: 'column', accessed: 8, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 23) }],
				[exampleCode({ access: '[3:7, c(1, 3)]' }), { type: 'row', accessed: 7, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 23) }]
			];

			for(const [test, result] of testCases) {
				/* @ignore-in-wiki */
				assertLinter(test, parser, test, 'dataframe-access-validation', [{ ...result, certainty: LintingResultCertainty.Certain }]);
			}
		});

		describe('Documentation test cases', () => {
			/** We expect the linter to report an issue, if a column is accessed by name via `$` that does not exist in the data frame. */
			assertLinter(
				'Column access by name',
				parser,
				'df <- data.frame(id = 1:3, name = c("Alice", "Bob", "Charlie"), score = c(90, 65, 75))\nprint(df$skill)',
				'dataframe-access-validation',
				[{ type: 'column', accessed: 'skill', access: '$', operand: 'df', range: [2, 7, 2, 14], certainty: LintingResultCertainty.Certain }]
			);

			/** We expect the linter to report an issue, if a column is accessed by index via `[` or `[[` that does not exist in the data frame. */
			assertLinter(
				'Column access by index',
				parser,
				'df <- data.frame(id = 1:3, name = c("Alice", "Bob", "Charlie"), score = c(90, 65, 75))\nprint(df[3:4])',
				'dataframe-access-validation',
				[{ type: 'column', accessed: 4, access: '[', operand: 'df', range: [2, 7, 2, 13], certainty: LintingResultCertainty.Certain }]
			);

			/** We expect the linter to report an issue, if a row is accessed by index via `[` or `[[` that does not exist in the data frame. */
			assertLinter(
				'Row access by index',
				parser,
				'df <- data.frame(id = 1:3, name = c("Alice", "Bob", "Charlie"), score = c(90, 65, 75))\nprint(df[[5, "score"]])',
				'dataframe-access-validation',
				[{ type: 'row', accessed: 5, access: '[[', operand: 'df', range: [2, 7, 2, 22], certainty: LintingResultCertainty.Certain }]
			);

			/** We expect the linter to report an issue, if a column is used in a `filter` function call that does not exist in the data frame. */
			assertLinter(
				'Filter access',
				parser,
				'df <- data.frame(id = 1:3, name = c("Alice", "Bob", "Charlie"), score = c(90, 65, 75))\ndf <- dplyr::filter(df, level > 70)',
				'dataframe-access-validation',
				[{ type: 'column', accessed: 'level', access: 'dplyr::filter', operand: 'df', range: [2, 7, 2, 35], certainty: LintingResultCertainty.Certain }]
			);

			/** We expect the linter to report an issue, if a column is selected or unselected in a `select` function that does not exist in the data frame. */
			assertLinter(
				'Select access',
				parser,
				'df <- data.frame(id = 1:3, name = c("Alice", "Bob", "Charlie"), score = c(90, 65, 75))\ndf <- dplyr::select(df, id, age, score)',
				'dataframe-access-validation',
				[{ type: 'column', accessed: 'age', access: 'dplyr::select', operand: 'df', range: [2, 7, 2, 39], certainty: LintingResultCertainty.Certain }]
			);

			/** We expect the linter to report an issue for all non-existent columns accessed in transformation functions like `filter`, `mutate`, and `select`, as well as all non-existent columns and rows accessed via access operators like `[`. */
			assertLinter(
				'Code example',
				parser,
				'library(dplyr)\n\ndf1 <- data.frame(\n    id = c(1, 2, 3, 4),\n    score = c(65, 85, 40, 90)\n)\n\ndf2 <- df1 %>%\n    filter(age > 50) %>%\n    mutate(level = skill^2) %>%\n    select(-name)\n\nprint(df2[1:5, 3])',
				'dataframe-access-validation',
				[
					{ type: 'column', accessed: 'age', access: 'filter', operand: 'df1', range: [9, 5, 9, 20], certainty: LintingResultCertainty.Certain },
					{ type: 'column', accessed: 'skill', access: 'mutate', range: [10, 5, 10, 27], certainty: LintingResultCertainty.Certain },
					{ type: 'column', accessed: 'name', access: 'select', range: [11, 5, 11, 17], certainty: LintingResultCertainty.Certain },
					{ type: 'row', accessed: 5, access: '[', operand: 'df2', range: [13, 7, 13, 17], certainty: LintingResultCertainty.Certain },
					{ type: 'column', accessed: 3, access: '[', operand: 'df2', range: [13, 7, 13, 17], certainty: LintingResultCertainty.Certain }
				]
			);
		});
	});
}));
