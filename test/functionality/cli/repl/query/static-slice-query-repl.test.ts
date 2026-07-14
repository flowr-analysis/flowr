import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplParser } from '../../../_helper/repl';
import { SliceDirection } from '../../../../../src/util/slice-direction';

describe('Static Slice Query REPL Parser', () => {
	const parser = SupportedQueries['static-slice'].fromLine;
	assertReplParser({ parser,
		label:         'empty line',
		line:          [''],
		expectedParse: {
			query: [],
		},
	});
	assertReplParser({ parser,
		label:         'invalid line',
		line:          ['(partial'],
		expectedParse: {
			query: [],
		},
	});
	assertReplParser({ parser,
		label:         'single criterion',
		line:          ['(1@var)'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var'],
				direction: SliceDirection.Backward
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'multiple criteria',
		line:          ['(1@var;$5;2@var;1:3)'],
		expectedParse: {
			query: [{
				type:      'static-slice',
				criteria:  ['1@var', '$5', '2@var', '1:3'],
				direction: SliceDirection.Backward
			}],
			rCode: undefined
		},
	});
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
		label:         'with code',
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
});
