import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertCriteriaReplParser, assertReplParser } from '../../../_helper/repl';
import { SliceDirection } from '../../../../../src/util/slice-direction';

describe('Static Slice Query REPL Parser', () => {
	const parser = SupportedQueries['static-slice'].fromLine;
	assertCriteriaReplParser(parser, criteria => [{ type: 'static-slice', criteria: [...criteria], direction: SliceDirection.Backward }]);
	assertReplParser({ parser,
		label:         'with direction',
		line:          ['(1@var;1:5)f'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var', '1:5'],
				direction: SliceDirection.Forward
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with direction and code',
		line:          ['(1@var)f', 'someCode'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var'],
				direction: SliceDirection.Forward
			}],
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'with inline flag',
		line:          ['(3@print)i'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['3@print'],
				direction:     SliceDirection.Backward,
				inlineSources: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'forward slice with inline flag',
		line:          ['(1@var)fi', 'someCode'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['1@var'],
				direction:     SliceDirection.Forward,
				inlineSources: true
			}],
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'inline flag before direction',
		line:          ['(1@var)if'],
		expectedParse: {
			query: [{
				type:          'static-slice',
				criteria:      ['1@var'],
				direction:     SliceDirection.Forward,
				inlineSources: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with include-callees flag',
		line:          ['(3@print)c'],
		expectedParse: {
			query: [{
				type:           'static-slice',
				criteria:       ['3@print'],
				direction:      SliceDirection.Backward,
				includeCallees: true
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'include-callees flag combined with inline and direction',
		line:          ['(1@var)fic', 'someCode'],
		expectedParse: {
			query: [{
				type:           'static-slice',
				criteria:       ['1@var'],
				direction:      SliceDirection.Forward,
				inlineSources:  true,
				includeCallees: true
			}],
			rCode: 'someCode',
		},
	});
});
