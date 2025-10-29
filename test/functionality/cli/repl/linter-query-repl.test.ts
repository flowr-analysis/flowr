import { describe } from 'vitest';
import { assertReplCompletions, assertReplParser } from '../../_helper/repl';
import { SupportedQueries } from '../../../../src/queries/query';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import { LintingRules } from '../../../../src/linter/linter-rules';

describe('Linter Query REPL Parser', () => {
	const parser = SupportedQueries['linter'].fromLine;
	assertReplParser({ parser,
		label:         'empty line',
		line:          [],
		expectedParse: {
			query: [{
				type:  'linter',
				rules: undefined
			}],
			rCode: undefined,
		},
	});
	assertReplParser({ parser,
		label:         'only prefix',
		line:          ['rules:'],
		expectedParse: {
			query: [{
				type:  'linter',
				rules: []
			}],
			rCode: undefined,
		},
	});
	assertReplParser({ parser,
		label:         'valid and invalid rules, with R code',
		line:          ['rules:invalid,file-path-validity,another-invalid,dead-code', 'some code'],
		expectedParse: {
			query: [{
				type:  'linter',
				rules: ['file-path-validity', 'dead-code']
			}],
			rCode: 'some code',
		},
	});
	assertReplParser({ parser,
		label:         'only R code',
		line:          ['some code'],
		expectedParse: {
			query: [{
				type:  'linter',
				rules: undefined
			}],
			rCode: 'some code',
		},
	});
});

describe('Linter Query REPL Completions', () => {
	const completer = SupportedQueries['linter'].completer;
	const allRules = Object.keys(LintingRules);
	assertReplCompletions({ completer,
		label:               'empty arguments',
		startingNewArg:      true,
		splitLine:           [''],
		expectedCompletions: ['rules:']
	});
	assertReplCompletions({ completer,
		label:               'partial prefix',
		startingNewArg:      false,
		splitLine:           ['r'],
		expectedCompletions: ['rules:']
	});
	assertReplCompletions({ completer,
		label:               'no rules',
		startingNewArg:      false,
		splitLine:           ['rules:'],
		expectedCompletions: allRules
	});
	assertReplCompletions({ completer,
		label:               'partial rule',
		startingNewArg:      false,
		splitLine:           ['rules:d'],
		expectedCompletions: allRules
	});
	assertReplCompletions({ completer,
		label:               'partial unique rule',
		startingNewArg:      false,
		splitLine:           ['rules:dead'],
		expectedCompletions: allRules
	});
	assertReplCompletions({ completer,
		label:               'multiple rules, one partial',
		startingNewArg:      false,
		splitLine:           ['rules:dead-code,file-path-val'],
		expectedCompletions: allRules.filter(l => !(l === 'dead-code'))
	});
	assertReplCompletions({ completer,
		label:               'multiple rules, no new one',
		startingNewArg:      false,
		splitLine:           ['rules:dead-code,file-path-validity'],
		expectedCompletions: [',']
	});
	assertReplCompletions({ completer,
		label:               'multiple rules, starting new one',
		startingNewArg:      false,
		splitLine:           ['rules:dead-code,file-path-validity,'],
		expectedCompletions: allRules.filter(l => !['dead-code','file-path-validity'].includes(l))
	});
	assertReplCompletions({ completer,
		label:               'all rules used',
		startingNewArg:      false,
		splitLine:           [`rules:${allRules.join(',')}`],
		expectedCompletions: [' ']
	});
	assertReplCompletions({ completer,
		label:               'rules finished',
		startingNewArg:      true,
		splitLine:           ['rules:dead'],
		expectedCompletions: [fileProtocol]
	});
	assertReplCompletions({ completer,
		label:               'rules finished',
		startingNewArg:      true,
		splitLine:           ['rules:dead'],
		expectedCompletions: [fileProtocol]
	});
});
