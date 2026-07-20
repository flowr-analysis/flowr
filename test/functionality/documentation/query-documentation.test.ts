import { assert, describe, test } from 'vitest';
import { assertAllQueriesDocumented, getPageNameForQuery } from '../../../src/documentation/doc-util/doc-query';
import { SupportedQueries } from '../../../src/queries/query';
import { SupportedVirtualQueries } from '../../../src/queries/virtual-query/virtual-queries';
/* importing the wiki module is what registers every query documentation */
import '../../../src/documentation/wiki-query';

describe('Query documentation', () => {
	test('every supported query is documented', () => {
		/* if this fails, add a `registerQueryDocumentation` entry in src/documentation/wiki-query.ts */
		assertAllQueriesDocumented();
	});

	test('every query maps to a distinct wiki page', () => {
		const pages = [...Object.keys(SupportedQueries), ...Object.keys(SupportedVirtualQueries)].map(getPageNameForQuery);
		assert.sameMembers([...new Set(pages)], pages, 'two queries claim the same wiki page');
		for(const page of pages) {
			assert.match(page, /^\[Query] \S/, 'query pages are prefixed to group them in the wiki');
		}
		/* the wiki resolves ' ' and '-' to the same url, so 'A B' and 'A-B' would silently be one page */
		const slugs = pages.map(p => p.replaceAll(' ', '-'));
		assert.sameMembers([...new Set(slugs)], slugs, 'two query pages share a wiki url');
	});
});
