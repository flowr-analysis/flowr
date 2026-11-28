import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { analyze } from '../_helper/analyzer';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { runSearch } from '../../../src/search/flowr-search-executor';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';

describe('flowR search, eager and lazy', withTreeSitter(parser => {
	test('lazy search matches eager search', async() => {
		const analyzer = await analyze(parser, 'x <- 1 \ny <- x + 2 \nprint(y)');
		const search = Q.all().filter(FlowrFilter.DropEmptyArguments).unique();
		const graphSize = (await analyzer.normalize()).idMap.size;

		const lazyResult = await runSearch(search, analyzer, { lazyThreshold: 0 });
		const eagerResult = await runSearch(search, analyzer, { lazyThreshold: graphSize + 10 });

		assert(lazyResult.hasLazy());
		assert(!eagerResult.hasLazy());

		const lazyIds = lazyResult.getElements().map(e => e.node.info.id);
		const eagerIds = eagerResult.getElements().map(e => e.node.info.id);
		assert.deepEqual(lazyIds, eagerIds);
	});
}));