import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type {
	LocationQuery
} from '../../../../src/queries/catalog/location-query/location-query-format';
import type { SourceRange } from '../../../../src/util/range';

describe('Location Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly LocationQuery[], expected: Record<string, SourceRange>) {
		assertQuery(label(name), shell, code, query, { location: { location: expected } });
	}

	testQuery('Single location query', 'x + 1', [{ type: 'location', nodeId: 0 }], { 0: [1,1,1,1] });
	testQuery('Multiple Queries', 'x + 1\ny + 2', [{ type: 'location', nodeId: 0 }, { type: 'location', nodeId: 3 }], { 0: [1,1,1,1], 3: [2,1,2,1] });
}));
