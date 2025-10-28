import { describe } from 'vitest';
import { assertReplCompletions } from '../../_helper/repl';
import { SupportedQueries } from '../../../../src/queries/query';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import { LintingRules } from '../../../../src/linter/linter-rules';

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
