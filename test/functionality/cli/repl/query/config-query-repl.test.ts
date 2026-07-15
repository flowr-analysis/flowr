import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplCompletions, assertReplParser } from '../../../_helper/repl';

describe('Config Query REPL Parser', () => {
	const parser = SupportedQueries['config'].fromLine;
	assertReplParser({ parser,
		label:         'empty line',
		line:          [],
		expectedParse: {
			query: [{
				type: 'config',
			}],
		},
	});
	assertReplParser({ parser,
		label:         'incomplete line',
		line:          ['+'],
		expectedParse: {
			query: [{
				type: 'config',
			}],
		},
	});
	assertReplParser({ parser,
		label:         'valid update',
		line:          ['+someConfig.secondLevel=new'],
		expectedParse: {
			query: [{
				type:   'config',
				update: { someConfig: { secondLevel: 'new' } },
			}],
		},
	});
	assertReplParser({ parser,
		label:         'invalid update line',
		line:          ['+someConfig.secondLevel'],
		expectedParse: {
			query: [{
				type: 'config',
			}],
		},
	});
});

describe('Config Query REPL Completions', () => {
	const completer = SupportedQueries['config'].completer;
	assertReplCompletions({ completer,
		label:               'empty arguments',
		startingNewArg:      true,
		splitLine:           [],
		expectedCompletions: ['+', '?']
	});
	assertReplCompletions({ completer,
		label:               'all root nodes',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: 'test' },
		splitLine:           ['+'],
		expectedCompletions: ['+aTopNode', '+bTopNode'],
	});
	assertReplCompletions({ completer,
		label:               'provides completion for partial root node',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: 'test' },
		splitLine:           ['+a'],
		expectedCompletions: ['+aTopNode'],
	});
	assertReplCompletions({ completer,
		label:               'adds dot after full root node',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test' } },
		splitLine:           ['+bTopNode'],
		expectedCompletions: ['+bTopNode.']
	});
	assertReplCompletions({ completer,
		label:               'all second level nodes',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test' } },
		splitLine:           ['+bTopNode.'],
		expectedCompletions: ['+bTopNode.aSecondNode', '+bTopNode.bSecondNode'],
	});
	assertReplCompletions({ completer,
		label:               'provides completion for partial second level node',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test' } },
		splitLine:           ['+bTopNode.b'],
		expectedCompletions: ['+bTopNode.bSecondNode'],
	});
	assertReplCompletions({ completer,
		label:               'adds equals sign after full path',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test' } },
		splitLine:           ['+bTopNode.bSecondNode'],
		expectedCompletions: ['+bTopNode.bSecondNode='],
	});
	assertReplCompletions({ completer,
		label:               'no completions after equals sign',
		startingNewArg:      false,
		splitLine:           ['+someConfigThing='],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'no completions after config update string',
		startingNewArg:      true,
		splitLine:           ['+someConfigThing', 'abc'],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'offers both booleans for a boolean field',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled'],
		expectedCompletions: ['+solver.sigdb.enabled=true', '+solver.sigdb.enabled=false'],
	});
	assertReplCompletions({ completer,
		label:               'still offers the booleans right after the equals sign',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled='],
		expectedCompletions: ['+solver.sigdb.enabled=true', '+solver.sigdb.enabled=false'],
	});
	assertReplCompletions({ completer,
		label:               'filters the value by what is already typed',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled=t'],
		expectedCompletions: ['+solver.sigdb.enabled=true'],
	});
	assertReplCompletions({ completer,
		label:               'inspecting a boolean field never assigns a value',
		startingNewArg:      false,
		splitLine:           ['?solver.sigdb.enabled'],
		expectedCompletions: ['?solver.sigdb.enabled'],
	});
	assertReplCompletions({ completer,
		label:               'does not re-complete a fully typed boolean value',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled=true'],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'offers an enum member and stops once it is fully typed',
		startingNewArg:      false,
		splitLine:           ['+solver.variables='],
		expectedCompletions: ['+solver.variables="disabled"', '+solver.variables="alias"', '+solver.variables="builtin"'],
	});
	assertReplCompletions({ completer,
		label:               'does not re-complete a fully typed enum value',
		startingNewArg:      false,
		splitLine:           ['+solver.variables="disabled"'],
		expectedCompletions: [],
	});
});
