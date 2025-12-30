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

describe('Does Call Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly DoesCallQuery[], results: Record<string, { call: SingleSlicingCriterion } | false>) {
		assertQuery(label(name), parser, code, query, (info) => {
			const idMap = info.normalize.idMap;
			const expectedResults: DoesCallQueryResult['results'] = {};
			for(const [k, v] of Object.entries(results)) {
				if(v === false) {
					expectedResults[k] = false;
				} else {
					expectedResults[k] = {
						call: slicingCriterionToId(v.call,idMap)
					};
				}
			}
			return {
				'does-call': {
					results: expectedResults
				}
			};
		});
	}

	testQuery('Calling eval', 'f <- function(x) { eval(x) }', [{
		type:    'does-call',
		queryId: '1',
		call:    '1@function',
		calls:   { type: 'name', name: 'eval', nameExact: true }
	}], {
		'1': { call: '1@function' }
	});

}));
