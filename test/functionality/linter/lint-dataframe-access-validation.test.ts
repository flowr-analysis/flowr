import { describe } from 'vitest';
import { LintingCertainty } from '../../../src/linter/linter-format';
import type { DataFrameAccessValidationResult } from '../../../src/linter/rules/dataframe-access-validation';
import { rangeFrom } from '../../../src/util/range';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';

describe('flowR linter', withTreeSitter(parser => {
	describe('Data frame access validation', () => {
		function exampleCode(params: { filter?: string, mutate?: string, join?: string, select?: string | number, access?: `$${string}` | `[${string}]` | `[[${string}]]` }) {
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
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = id)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 2)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = c(id, name))',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 1:2)',
				'df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = id:name)',
				'df <- data.frame(id = 1:5, level = 6:10)\ntransform(df, label = "A")',
				'df <- data.frame(id = 1:5, level = 6:10)\ntransform(df, id = 100 + id, score = level^2)',
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
			type ExpectedLinterResult = Omit<DataFrameAccessValidationResult, 'certainty' | 'quickFix'>;

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
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = score)', { type: 'column', accessed: 'score', access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 26) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 4)', { type: 'column', accessed: 4, access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 22) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = c(id, score))', { type: 'column', accessed: 'score', access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 33) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = 2:3)', { type: 'column', accessed: 3, access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 24) }],
				['df <- data.frame(id = 1:5, name = "A")\nsubset(df, select = c(1, 4))', { type: 'column', accessed: 4, access: 'subset', operand: 'df', range: rangeFrom(2, 1, 2, 28) }],
				['df <- data.frame(id = 1:5, level = 6:10)\ntransform(df, score = value^2)', { type: 'column', accessed: 'value', access: 'transform', operand: 'df', range: rangeFrom(2, 1, 2, 30) }],
				['df <- data.frame(id = 1:5, level = 6:10)\ntransform(df, avg = mean(age), score = level^2)', { type: 'column', accessed: 'age', access: 'transform', operand: 'df', range: rangeFrom(2, 1, 2, 47) }],
				['df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8)\nmerge(df1, df2, by = "key")', { type: 'column', accessed: 'key', access: 'merge', operand: 'df1', range: rangeFrom(3, 1, 3, 27) }],
				['df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- data.frame(id = 5:8, name = "B")\nmerge(df1, df2, by = c("id", "type"))', { type: 'column', accessed: 'type', access: 'merge', operand: 'df1', range: rangeFrom(3, 1, 3, 37) }],
				[exampleCode({ filter: 'skill' }), { type: 'column', accessed: 'skill', access: 'filter', operand: 'df1', range: rangeFrom(13, 5, 13, 22) }],
				[exampleCode({ mutate: 'value' }), { type: 'column', accessed: 'value', access: 'mutate', operand: undefined, range: rangeFrom(14, 5, 14, 27) }],
				[exampleCode({ join: 'key' }), { type: 'column', accessed: 'key', access: 'left_join', operand: undefined, range: rangeFrom(15, 5, 15, 30) }],
				[exampleCode({ select: 'name' }), { type: 'column', accessed: 'name', access: 'select', operand: undefined, range: rangeFrom(16, 5, 16, 17) }],
				[exampleCode({ select: 6 }), { type: 'column', accessed: 6, access: 'select', operand: undefined, range: rangeFrom(16, 5, 16, 14) }],
				[exampleCode({ access: '$age' }), { type: 'column', accessed: 'age', access: '$', operand: 'df3', range: rangeFrom(18, 7, 18, 13) }],
				[exampleCode({ access: '[, "skill"]' }), { type: 'column', accessed: 'skill', access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 20) }],
				[exampleCode({ access: '[["name"]]' }), { type: 'column', accessed: 'name', access: '[[', operand: 'df3', range: rangeFrom(18, 7, 18, 19) }],
				[exampleCode({ access: '[5]' }), { type: 'column', accessed: 5, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 12) }],
				[exampleCode({ access: '[[12]]' }), { type: 'column', accessed: 12, access: '[[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[6, ]' }), { type: 'row', accessed: 6, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 14) }],
				[exampleCode({ access: '[5, 6]' }), { type: 'column', accessed: 6, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[7, 4]' }), { type: 'row', accessed: 7, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 15) }],
				[exampleCode({ access: '[3:5]' }), { type: 'column', accessed: 5, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 14) }],
				[exampleCode({ access: '[3:5, c(2, 8)]' }), { type: 'column', accessed: 8, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 23) }],
				[exampleCode({ access: '[3:6, c(1, 3)]' }), { type: 'row', accessed: 6, access: '[', operand: 'df3', range: rangeFrom(18, 7, 18, 23) }]
			];

			for(const [test, result] of testCases) {
				/* @ignore-in-wiki */
				assertLinter(test, parser, test, 'dataframe-access-validation', [{ ...result, certainty: LintingCertainty.Definitely }]);
			}
		});
	});
}));
