import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplParser } from '../../../_helper/repl';

describe('Abstract Interpretation Query REPL Parser', () => {
	const parser = SupportedQueries['absint'].fromLine;
	assertReplParser({ parser,
		label:         'empty line',
		line:          [''],
		expectedParse: {
			query: []
		},
	});
	assertReplParser({ parser,
		label:         'only type',
		line:          ['df-shape'],
		expectedParse: {
			query: {
				type:      'absint',
				inference: 'df-shape',
				criteria:  undefined
			},
			rCode: undefined
		},
	});
	assertReplParser({ parser,
		label:         'missing type',
		line:          ['(1@var)'],
		expectedParse: {
			query: []
		},
	});
	assertReplParser({ parser,
		label:         'single criterion',
		line:          ['df-shape', '(1@var)', 'var <- data.frame(1:5)'],
		expectedParse: {
			query: {
				type:      'absint',
				inference: 'df-shape',
				criteria:  ['1@var'],
			},
			rCode: 'var <- data.frame(1:5)'
		},
	});
	assertReplParser({ parser,
		label:         'multiple criteria',
		line:          ['df-shape', '(1@var;$1;1@data.frame;1:8)', 'var <- data.frame(1:5)'],
		expectedParse: {
			query: {
				type:      'absint',
				inference: 'df-shape',
				criteria:  ['1@var', '$1', '1@data.frame', '1:8'],
			},
			rCode: 'var <- data.frame(1:5)'
		},
	});
	assertReplParser({ parser,
		label:         'with code',
		line:          ['df-shape', '(1@var)', 'someCode'],
		expectedParse: {
			query: {
				type:      'absint',
				inference: 'df-shape',
				criteria:  ['1@var'],
			},
			rCode: 'someCode',
		},
	});
	assertReplParser({ parser,
		label:         'only code',
		line:          ['df-shape', 'someCode'],
		expectedParse: {
			query: {
				type:      'absint',
				inference: 'df-shape',
				criteria:  undefined
			},
			rCode: 'someCode',
		},
	});
});
