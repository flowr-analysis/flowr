import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';


import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { Queries } from '../../../../src/queries/query';

describe('Multiple queries', withTreeSitter(ts => {
	function testQueries(name: string, code: string, query: Queries) {
		assertQuery(label(name), ts, code, query);
	}

	testQueries('id map and dataflow', 'x <- 2', [
		{ type: 'dataflow' },
		{ type: 'id-map' }
	]);

}));