import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplParser } from '../../../_helper/repl';

describe('Lineage Query REPL Parser', () => {
	const parser = SupportedQueries['lineage'].fromLine;
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
			query: {
				type:      'lineage',
				criterion: '1@var',
			},
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with code',
		line:          ['(1@var)', 'someCode'],
		expectedParse: {
			query: {
				type:      'lineage',
				criterion: '1@var',
			},
			rCode: 'someCode',
		},
	});
});
