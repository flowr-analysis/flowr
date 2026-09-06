import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { assert, describe } from 'vitest';
import type {
	ResolveValueQuery,
	ResolveValueQueryResult
} from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';
import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import { stringFrom } from '../../../../src/dataflow/eval/values/string/string-constants';
import { Top } from '../../../../src/dataflow/eval/values/r-value';
import type { ResolveResult } from '../../../../src/dataflow/eval/resolve/alias-tracking';
import { withTreeSitter } from '../../_helper/shell';
import { intervalFrom, intervalFromValues } from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import { getScalarFromInteger } from '../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { vectorFrom } from '../../../../src/dataflow/eval/values/vectors/vector-constants';

describe('Resolve Value Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, criteria: SlicingCriteria, expected: ResolveResult[][]) {
		const queries: ResolveValueQuery[] = [{ type: 'resolve-value' as const, criteria }];
		assertQuery(label(name), parser, code, queries, ({ dataflow }) => {
			const results: ResolveValueQueryResult['results'] = {};

			const idMap = dataflow.graph.idMap;
			assert(idMap !== undefined);

			queries.forEach((query, idx) => {
				const key = fingerPrintOfQuery(query);
				results[key] = {
					values: expected[idx]
				};
			});

			return {
				'resolve-value': { results }
			};
		});
	}

	testQuery('Single dataflow', 'x <- 1', ['1@x'], [[setFrom(intervalFrom(1, 1))]]);
	testQuery('Intermediary', 'x <- 1\ny <- x\nprint(y)', ['3@y'], [[setFrom(intervalFrom(1, 1))]]);
	testQuery('Mystic Intermediary', 'x <- 1\ny <- f(x)\nprint(y)', ['3@y'], [[Top]]);
	testQuery('Either or', 'if(u) { x <- 1 } else { x <- 2 }\nprint(x)', ['2@x'], [[setFrom(intervalFrom(2, 2), intervalFrom(1, 1))]]);
	testQuery('Big vector', `results <- c("A", "B", "C", "D", "E")
		col <- vector()
		
		for (i in u) {
		  col <- append(col, ifelse(results[[i]] == "empty", "empty", results[[i]]))
		}
		
		f1 <- data.frame(col)
		print(col)`, ['8@col'], [[Top]]);

	testQuery('Local defined by a call', 'p <- file.path("data", "x.csv")\nread.csv(p)', ['2@p'], [[setFrom(stringFrom('data/x.csv'))]]);

	/* the project root `here` prefixes is implicit, so what it folds to is the path below it */
	describe('here::here', () => {
		testQuery('joins its arguments', 'p <- here::here("data", "x.csv")\nread.csv(p)', ['2@p'], [[setFrom(stringFrom('data/x.csv'))]]);
		testQuery('the root itself', 'p <- here::here()\nread.csv(p)', ['2@p'], [[setFrom(stringFrom('.'))]]);
		/* the fold belongs to the `here` package, another one of that name is a function we know nothing about */
		testQuery('another package of that name is not folded', 'p <- foo::here("data")\nread.csv(p)', ['2@p'], [[Top]]);
		testQuery('a paste of another package is not folded either', 'p <- foo::paste0("a", "b")\nread.csv(p)', ['2@p'], [[Top]]);
		/* attaching the package must not hide what flowR states about its functions */
		testQuery('the bare name once the package is attached', 'library(here)\np <- here("data", "x.csv")\nread.csv(p)', ['3@p'],
			[[setFrom(stringFrom('data/x.csv'))]]);
	});

	describe('Resolve Parameters and Calls', () => {
		testQuery('No call-sites', 'function() { x <- 1 }', ['1@x'], [[setFrom(intervalFrom(1, 1))]]);
		testQuery('No call-sites with inner use', 'function() { x <- 42\n x }', ['2@x'], [[setFrom(intervalFrom(42, 42))]]);
		testQuery('No call-sites with global assignment', 'f <- function() { x <<- 42 }\nf()\nprint(x)', ['3@x'], [[setFrom(intervalFrom(42, 42))]]);
		testQuery('No call-sites with parameter', 'f <- function(x=42) { \nprint(x)}', ['2@x'], [[Top]]);
		testQuery('No call-sites with calculated parameter', 'f <- function(x=42+1) { \nprint(x)}', ['2@x'], [[Top]]);
		testQuery('No call-sites with maybe parameter', 'f <- function(x=42) { if(u) x <- 2\nprint(x)}', ['2@x'], [[Top]]);
		testQuery('No call-sites with maybe parameter and calc', 'f <- function(x=42+1) { if(u) x <- 2\nprint(x)}', ['2@x'], [[Top]]);
	});

	/* `:` counts down whenever the second bound is the smaller one */
	describe('Sequences', () => {
		testQuery('ascending', 'x <- 1:3\nprint(x)', ['2@x'], [[setFrom(vectorFrom([1, 2, 3].map(n => getScalarFromInteger(n))))]]);
		testQuery('descending', 'x <- 3:1\nprint(x)', ['2@x'], [[setFrom(vectorFrom([3, 2, 1].map(n => getScalarFromInteger(n))))]]);
		testQuery('descending through variables', 'a <- 5\nb <- 2\nx <- a:b\nprint(x)', ['4@x'],
			[[setFrom(vectorFrom([5, 4, 3, 2].map(n => getScalarFromInteger(n))))]]);
		/* the sequence stops before it would pass its end, so a fractional bound is not reached */
		testQuery('a fractional bound', 'x <- 1:3.5\nprint(x)', ['2@x'], [[setFrom(vectorFrom([1, 2, 3].map(n => getScalarFromInteger(n))))]]);
		/* a bound that names no position to count from or to leaves the whole sequence open */
		testQuery('an unbounded end', 'x <- 1:Inf\nprint(x)', ['2@x'], [[Top]]);
	});

	/* a name the program may or may not have taken from its built-in stands for either of the two */
	describe('Conditionally shadowed calls', () => {
		testQuery('a shadowed built-in', 'if(u) toupper <- function(x) "z"\nx <- toupper("a")\nprint(x)', ['3@x'], [[Top]]);
		testQuery('a shadowed operator', 'if(u) `+` <- function(a, b) 0\nx <- 1 + 2\nprint(x)', ['3@x'], [[Top]]);
		testQuery('the built-in itself', 'x <- toupper("a")\nprint(x)', ['2@x'], [[setFrom(stringFrom('A'))]]);
		testQuery('a definition that always shadows it', 'toupper <- function(x) "z"\nx <- toupper("a")\nprint(x)', ['3@x'],
			[[setFrom(stringFrom('z'))]]);
	});

	describe('String escapes', () => {
		testQuery('an escaped tab', 'x <- "a\\tb"\nprint(x)', ['2@x'], [[setFrom(stringFrom('a\tb'))]]);
		testQuery('an escaped quote', 'x <- "a\\"b"\nprint(x)', ['2@x'], [[setFrom(stringFrom('a"b'))]]);
		testQuery('an escaped backslash', 'x <- "a\\\\b"\nprint(x)', ['2@x'], [[setFrom(stringFrom('a\\b'))]]);
		testQuery('a code point', 'x <- "\\u00e9"\nprint(x)', ['2@x'], [[setFrom(stringFrom('é'))]]);
		testQuery('counted as characters', 'x <- nchar("a\\tb")\nprint(x)', ['2@x'], [[setFrom(intervalFrom(3, 3))]]);
		testQuery('joined as characters', 'p <- file.path("C:\\\\a", "b")\nread.csv(p)', ['2@p'], [[setFrom(stringFrom('C:\\a/b'))]]);
		/* a raw string spells out no escapes, so its characters are the ones it is written with */
		testQuery('a raw string', 'x <- r"(a\\b)"\nprint(x)', ['2@x'], [[setFrom(stringFrom({ str: 'a\\b', quotes: '"', flag: 'raw' }))]]);
		/* an escape R would reject states nothing about what the program computes */
		testQuery('an escape R rejects', 'x <- "a\\qb"\nprint(x)', ['2@x'], [[Top]]);
	});

	/* a complex literal is no real number, so nothing folds it as the one its lexeme starts with */
	describe('Complex numbers', () => {
		testQuery('the literal itself', 'x <- 2i\nprint(x)', ['2@x'],
			[[setFrom(intervalFromValues(getScalarFromInteger(2, false, true)))]]);
		testQuery('not added up', 'x <- 1i + 1i\nprint(x)', ['2@x'], [[Top]]);
	});

	/* R answers `NA` for everything its 32-bit integers cannot hold, so those fold to nothing */
	describe('Bit twiddling', () => {
		testQuery('within the integers', 'x <- bitwShiftL(1, 3)\nprint(x)', ['2@x'], [[setFrom(intervalFrom(8, 8))]]);
		testQuery('a result that is none', 'x <- bitwShiftL(1, 31)\nprint(x)', ['2@x'], [[Top]]);
		testQuery('more places than there are', 'x <- bitwShiftL(1, 33)\nprint(x)', ['2@x'], [[Top]]);
		testQuery('an operand that is none', 'x <- bitwAnd(2^33, 1)\nprint(x)', ['2@x'], [[Top]]);
	});

	describe('For now suboptimal', () =>  {
		testQuery('Unknown df', `
df <- data.frame(x = 1:10, y = 1:10)
print(df)
		`, ['3@df'], [[Top]]);
		testQuery('Unknown df', `
df <- data.frame(x = 1:10, y = 1:10)
df <- df[2,]
df[1] <- c(1,2,3)
print(df)
		`, ['5@df'], [[Top]]);
		testQuery('Loops kill', 'x <- 42\nwhile(x < 10) { x <- x + 1 }\nprint(x)', ['3@x'], [[Top]]);

	});

}));
