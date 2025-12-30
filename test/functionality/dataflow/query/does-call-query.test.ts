import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type {
	DoesCallQuery,
	DoesCallQueryResult
} from '../../../../src/queries/catalog/does-call-query/does-call-query-format';

describe('Does Call Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly DoesCallQuery[], results: DoesCallQueryResult['results']) {
		assertQuery(label(name), parser, code, query, () => ({ 'does-call': { results } }));
	}

	testQuery('Calling eval', 'f <- function(x) { eval(x) }', [{
		type:    'does-call',
		queryId: '1',
		call:    '1@function',
		calls:   { type: 'name', name: 'eval', nameExact: true }
	}], {
		'1': { callsMatching: [2] }
	});

}));
