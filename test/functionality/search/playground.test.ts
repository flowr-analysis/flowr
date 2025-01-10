import { describe, test } from 'vitest';
import type { FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilterCombinator as F } from '../../../src/search/flowr-search-filters';
import { mermaidCodeToUrl } from '../../../src/util/mermaid/mermaid';
import { flowrSearchToMermaid } from '../../../src/search/flowr-search-printer';

describe('flowR Search (playground)', () => {
	function print(search: FlowrSearchLike) {
		console.log(JSON.stringify(search, null, 2));
		console.log(mermaidCodeToUrl(flowrSearchToMermaid(search)));
	}
	test('poor mans testing', () => {
		print(Q.all().filter(RType.Comment));
		const query = Q.get({ line: 3, name: 'x' }).filter(
			F.is(VertexType.Use).or(RType.Number)
		).first().build();
		print(query);
	});
});
