import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplParser } from '../../../_helper/repl';

describe('Resolve Value Query REPL Parser', () => {
	const parser = SupportedQueries['resolve-value'].fromLine;
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
				type:     'resolve-value',
				criteria: ['1@var'],
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'multiple criteria',
		line:          ['(1@var,$5,2@var,1:3)'],
		expectedParse: {
			query: [{
				type:     'resolve-value',
				criteria: ['1@var', '$5', '2@var', '1:3'],
			}],
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with code',
		line:          ['(1@var)', 'someCode'],
		expectedParse: {
			query: [{
				type:     'resolve-value',
				criteria: ['1@var'],
			}],
			rCode: 'someCode',
		},
	});
});
