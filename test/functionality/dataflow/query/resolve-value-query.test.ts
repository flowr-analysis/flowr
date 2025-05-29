import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import { assert, describe } from 'vitest';
import type {
	ResolveValueQuery,
	ResolveValueQueryResult
} from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';
import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import { intervalFrom } from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import { Top } from '../../../../src/dataflow/eval/values/r-value';
import type { ResolveResult } from '../../../../src/dataflow/eval/resolve/alias-tracking';

describe.sequential('Resolve Value Query', withShell(shell => {
	function testQuery(name: string, code: string, criteria: SlicingCriteria, expected: ResolveResult[][]) {
		const queries: ResolveValueQuery[] = [{ type: 'resolve-value' as const, criteria }];
		assertQuery(label(name), shell, code, queries, ({ dataflow }) => {
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


	testQuery('Single dataflow', 'x <- 1', ['1@x'], [[setFrom(intervalFrom(1,1))]]);
	testQuery('Intermediary', 'x <- 1\ny <- x\nprint(y)', ['3@y'], [[setFrom(intervalFrom(1,1))]]);
	testQuery('Mystic Intermediary', 'x <- 1\ny <- f(x)\nprint(y)', ['3@y'], [[Top]]);
	testQuery('Either or', 'if(u) { x <- 1 } else { x <- 2 }\nprint(x)', ['2@x'], [[setFrom(intervalFrom(2,2), intervalFrom(1,1))]]);
	testQuery('Big vector', `results <- c("A", "B", "C", "D", "E")
		col <- vector()
		
		for (i in u) {
		  col <- append(col, ifelse(results[[i]] == "empty", "empty", results[[i]]))
		}
		
		f1 <- data.frame(col)
		print(col)`, ['8@col'], [[Top]]);

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
