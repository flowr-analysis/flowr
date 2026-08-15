import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplParser } from '../../../_helper/repl';
import { LocationMapSpan } from '../../../../../src/queries/catalog/location-map-query/location-map-query-format';

describe('Location Map Query REPL Parser', () => {
	const parser = SupportedQueries['location-map'].fromLine;
	assertReplParser({ parser,
		label:         'empty line',
		line:          [''],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  undefined
			},
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'single criterion',
		line:          ['(1@var)'],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  ['1@var'],
			},
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'with code',
		line:          ['(1@var)', 'someCode'],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  ['1@var'],
			},
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'only code',
		line:          ['someCode'],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  undefined
			},
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'with a span',
		line:          ['(1@var)', 'statement', 'someCode'],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  ['1@var'],
				span: LocationMapSpan.Statement
			},
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'a span without criteria',
		line:          ['full', 'someCode'],
		expectedParse: {
			query: {
				type: 'location-map',
				ids:  undefined,
				span: LocationMapSpan.Full
			},
			rCode: 'someCode',
		},
	});
});

