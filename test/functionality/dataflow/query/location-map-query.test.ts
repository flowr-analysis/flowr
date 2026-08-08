import { describe } from 'vitest';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withTreeSitter } from '../../_helper/shell';
import { LocationMapSpan, type FileId, type FilePath } from '../../../../src/queries/catalog/location-map-query/location-map-query-format';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import type { SourceRange } from '../../../../src/util/range';

/** a call spanning four lines, so that the token of the `<-` and the statement around it differ */
const multiLine = `p <- ggplot(d,
            aes(a, b)) +
     geom_point(
       size = 2)
x <- 1`;

describe('Location Map Query', withTreeSitter(parser => {
	/** asserts the range the query reports for one node of {@link multiLine} under `span` */
	function testSpan(name: string, criterion: SlicingCriterion, span: LocationMapSpan, expected: SourceRange) {
		assertQuery(label(name), parser, multiLine, [{ type: 'location-map', ids: [criterion], span }], ({ normalize }) => ({
			'location-map': { map: { files: { 0: '@inline' }, ids: { [SlicingCriterion.parse(criterion, normalize.idMap)]: [0, expected] as [FileId, SourceRange] } } }
		}));
	}

	testSpan('the token of an operator is just that token', '1@<-', LocationMapSpan.Token, [1, 3, 1, 4]);
	testSpan('its subtree is the whole assignment', '1@<-', LocationMapSpan.Full, [1, 1, 4, 16]);
	testSpan('so is the statement it belongs to', '1@<-', LocationMapSpan.Statement, [1, 1, 4, 16]);
	/* the deepest node of the statement resolves to the same statement, which is what a criterion inside one needs */
	testSpan('a node nested in the call reports the same statement', '4@size', LocationMapSpan.Statement, [1, 1, 4, 16]);
	testSpan('a statement of its own is not widened', '5@x', LocationMapSpan.Statement, [5, 1, 5, 6]);

	/* only an unfiltered query reports the whole map; asking for ids answers with those */
	assertQuery(label('ids that resolve to nothing report nothing'), parser, multiLine,
		[{ type: 'location-map', ids: ['9@nope'] }],
		{ 'location-map': { map: { files: { 0: '@inline' } as Record<FileId, FilePath>, ids: {} } } });
}));
