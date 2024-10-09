import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type {
	LabeledSourceRange,
	LocationQuery
} from '../../../../src/queries/catalog/location-query/location-query-format';



describe('Location Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly LocationQuery[], expected: Record<string, LabeledSourceRange>) {
		assertQuery(label(name), shell, code, query, { location: { location: expected } });
	}

	testQuery('Single location query', 'x + 1', [{ type: 'location', nodeId: 0 }], { 0: {
		startLine:   1,
		startColumn: 1,
		endLine:     1,
		endColumn:   1
	} });
	testQuery('Multiple Queries', 'x + 1\ny + 2', [{ type: 'location', nodeId: 0 }, { type: 'location', nodeId: 3 }], { 0: {
		startLine:   1,
		startColumn: 1,
		endLine:     1,
		endColumn:   1
	}, 3: {
		startLine:   2,
		startColumn: 1,
		endLine:     2,
		endColumn:   1
	} });
}));
