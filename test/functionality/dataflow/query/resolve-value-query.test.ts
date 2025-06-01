import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { assert, describe } from 'vitest';
import type {
	ResolveValueQuery,
	ResolveValueQueryResult
} from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';


import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import { numVal } from '../../_helper/ast-builder';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { withTreeSitter } from '../../_helper/shell';

describe('Resolve Value Query', withTreeSitter( parser => {
	function testQuery(name: string, code: string, criteria: SlicingCriteria, expected: readonly unknown[][]) {
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


	testQuery('Single dataflow', 'x <- 1', ['1@x'], [[numVal(1)]]);
	testQuery('Intermediary', 'x <- 1\ny <- x\nprint(y)', ['3@y'], [[numVal(1)]]);
	testQuery('Mystic Intermediary', 'x <- 1\ny <- f(x)\nprint(y)', ['3@y'], [[]]);
	testQuery('Either or', 'if(u) { x <- 1 } else { x <- 2 }\nprint(x)', ['2@x'], [[numVal(2), numVal(1)]]);
	testQuery('Big vector', `results <- c("A", "B", "C", "D", "E")
col <- vector()

for (i in u) {
  col <- append(col, ifelse(results[[i]] == "empty", "empty", results[[i]]))
}

f1 <- data.frame(col)
print(col)`, ['8@col'], [[]]);

	describe('For now suboptimal', () =>  {
		testQuery('Unknown df', `
df <- data.frame(x = 1:10, y = 1:10)
print(df)
		`, ['3@df'], [[]]);
		testQuery('Unknown df', `
df <- data.frame(x = 1:10, y = 1:10)
df <- df[2,]
df[1] <- c(1,2,3)
print(df)
		`, ['5@df'], [[]]);
		testQuery('Loops kill', 'x <- 42\nwhile(x < 10) { x <- x + 1 }\nprint(x)', ['3@x'], [[]]);

	});

}));
