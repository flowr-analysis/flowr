import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeQueries } from '../../../src/queries/query';
import { DataColumnsContext, DataColumnsQueryDefinition } from '../../../src/queries/catalog/data-columns-query/data-columns-query-format';
import { datasetShape } from '../../../src/util/r-datasets';

const Penguins = ['species', 'island', 'bill_len', 'bill_dep', 'flipper_len', 'body_mass', 'sex', 'year'];
const Starwars = datasetShape('starwars', 'dplyr')?.columns ?? [];

/** the columns and their context at `line`:`col` of `code`, where `§` in the code marks the position and is removed */
async function columnsAt(code: string): Promise<{ context?: DataColumnsContext, columns: readonly string[] }> {
	const at = code.indexOf('§');
	const before = code.slice(0, at);
	const line = before.split('\n').length;
	const col = at - before.lastIndexOf('\n');
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	analyzer.addRequest(code.slice(0, at) + code.slice(at + 1));
	const position = `${line}:${col}`;
	const { context, columns } = (await executeQueries({ analyzer }, [{ type: 'data-columns', positions: [position] }]))['data-columns'].results[position];
	return { context, columns };
}

function expectColumns(name: string, code: string, context: DataColumnsContext | undefined, columns: readonly string[]) {
	test(name, async() => {
		assert.deepStrictEqual(await columnsAt(code), context === undefined ? { context: undefined, columns: [] } : { context, columns });
	});
}

describe('Data Columns Query', () => {
	describe('data sets', () => {
		expectColumns('a base data set in a native pipe', 'library(dplyr)\npenguins |> filter(year > 2008, bi§)', DataColumnsContext.Masked, Penguins);
		expectColumns('a base data set in a magrittr pipe', 'library(dplyr)\npenguins %>% mutate(r = bill_len / bi§)', DataColumnsContext.Masked, Penguins);
		expectColumns('subset', 'subset(mtcars, mp§ > 20)', DataColumnsContext.Masked, ['mpg', 'cyl', 'disp', 'hp', 'drat', 'wt', 'qsec', 'vs', 'am', 'gear', 'carb']);
		expectColumns('with, nested in a call', 'with(iris, mean(Se§))', DataColumnsContext.Masked, ['Sepal.Length', 'Sepal.Width', 'Petal.Length', 'Petal.Width', 'Species']);
		expectColumns('aes of a ggplot', 'library(ggplot2)\nggplot(penguins, aes(x = bi§))', DataColumnsContext.Masked, Penguins);
		expectColumns('aes of a layer added to a ggplot', 'library(ggplot2)\nggplot(penguins) + geom_point(aes(colour = sp§))', DataColumnsContext.Masked, Penguins);
		expectColumns('a data set of a loaded package', 'library(dplyr)\nfilter(starwars, ha§ == 1)', DataColumnsContext.Masked, Starwars);
		expectColumns('a data set of a package by its namespace', 'dplyr::starwars |> dplyr::select(na§)', DataColumnsContext.Masked, Starwars);
		expectColumns('the data set of a package not loaded is unknown', 'filter(starwars, ha§ == 1)', undefined, []);
		expectColumns('a dollar access', 'starwars <- dplyr::starwars\nstarwars$ma§', DataColumnsContext.Access, Starwars);
	});
	describe('data frames of the program', () => {
		expectColumns('a data frame the program creates', 'library(dplyr)\ndf <- data.frame(id = 1:3, score = 4:6)\ndf |> filter(sc§)', DataColumnsContext.Masked, ['id', 'score']);
		expectColumns('a column the program adds', 'library(dplyr)\nd <- mutate(penguins, ratio = bill_len / bill_dep)\nfilter(d, ra§)', DataColumnsContext.Masked, [...Penguins, 'ratio']);
		expectColumns('a local variable shadows the data set', 'penguins <- data.frame(a = 1)\nsubset(penguins, a§)', DataColumnsContext.Masked, ['a']);
	});
	describe('no columns', () => {
		expectColumns('the data argument itself', 'library(dplyr)\nfilter(pengu§, year > 2008)', undefined, []);
		expectColumns('a call evaluating its arguments as usual', 'mean(penguins, na§)', undefined, []);
		expectColumns('outside of any call', 'x <- 1\nx§', undefined, []);
	});
	test('the repl line names the positions', () => {
		const parsed = DataColumnsQueryDefinition.fromLine(undefined as never, ['(2:20;3:4)', 'x', '<-', '1'], undefined as never);
		assert.deepStrictEqual(parsed, { query: { type: 'data-columns', positions: ['2:20', '3:4'] }, rCode: 'x <- 1' });
	});
});
