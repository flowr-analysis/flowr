import { describe, test } from 'vitest';
import type { FlowrSearchBuilderType } from '../../../src/search/flowr-search-builder';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilterCombinator as F } from '../../../src/search/flowr-search-filters';

describe('flowR Search (playground)', () => {
	function print(search: FlowrSearchBuilderType) {
		console.log(JSON.stringify(search, null, 2));
	}
	test('poor mans testing', () => {
		print(Q.all().filter(RType.Comment));
		print(Q.get({ line: 3, name: 'x' }).filter(
			F.is(VertexType.Use).or(RType.Number)
		).first());
	});
});
