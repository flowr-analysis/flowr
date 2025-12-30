import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type {
	DoesCallQuery,
	DoesCallQueryResult
} from '../../../../src/queries/catalog/does-call-query/does-call-query-format';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { DeepWritable } from 'ts-essentials';

describe('Does Call Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, rawQueries: readonly Omit<DoesCallQuery, 'type'> [], results: (SingleSlicingCriterion|false)[]) {
		let i = 0;
		const query: DoesCallQuery[] = [];
		for(const rq of rawQueries) {
			const q = rq as DeepWritable<DoesCallQuery>;
			q.type = 'does-call';
			if(!q.queryId) {
				(q as DeepWritable<typeof q>).queryId = String(++i);
			}
			query.push(q as DoesCallQuery);
		}
		// TODO: add index to the respective query as id, accept an array of findings with either an id or a boolean
		assertQuery(label(name), parser, code, query, (info) => {
			const idMap = info.normalize.idMap;
			const expectedResults: DoesCallQueryResult['results'] = {};
			let i = 0;
			for(const v of results) {
				expectedResults[String(++i)] = v === false ? false : { call: slicingCriterionToId(v, idMap) };
			}
			return {
				'does-call': {
					results: expectedResults
				}
			};
		});
	}
	const n = (name: string) => ({ type: 'name', name, nameExact: true } as const);
	const r = (name: string) => ({ type: 'name', name, nameExact: false } as const);

	testQuery('Calling eval (named & regex)', 'f <- function(x) { eval(x) }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '1@function',  calls: r('eval') },
		{ call: '2@f',  calls: n('eval') },
		{ call: '2@f',  calls: r('eval') },
		{ call: '1@eval',  calls: n('eval') },
		{ call: '1@eval',  calls: r('eval') }
	], ['1@function', '1@function', '2@f', '2@f', '1@eval', '1@eval']);

	testQuery('Not calling eval (named & regex)', 'f <- function(x) { rofl(x) }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '1@function',  calls: r('eval') },
		{ call: '2@f',  calls: n('eval') },
		{ call: '2@f',  calls: r('eval') },
		{ call: '1@rofl',  calls: n('eval') },
		{ call: '1@rofl',  calls: r('eval') }
	], [false, false, false, false, false, false]);

	testQuery('Calling eval with indirection', 'g <- function() { if(u) { eval(x) } }\nf <- function(x) { g() }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '2@function',  calls: n('eval') },
		{ call: '3@f',  calls: n('eval') },
	], ['1@function', '2@function', '3@f']);

	testQuery('Calling eval with alias', 'g <- eval\nf <- function(x) { g(x) }\nf(1)', [
		{ call: '1@g',  calls: n('eval') },
		{ call: '2@g',  calls: n('eval') },
		{ call: '2@function',  calls: n('eval') },
		{ call: '3@f',  calls: n('eval') },
	], [false, '2@g', '2@function', '3@f']);
}));
