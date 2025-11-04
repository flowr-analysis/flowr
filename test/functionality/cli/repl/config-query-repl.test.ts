import { describe } from 'vitest';
import { SupportedQueries } from '../../../../src/queries/query';
import { assertReplCompletions } from '../../_helper/repl';

describe('Config Query REPL Completions', () => {
	const completer = SupportedQueries['config'].completer;
	assertReplCompletions({ completer,
		label:               'empty arguments',
		startingNewArg:      true,
		splitLine:           [],
		expectedCompletions: ['+']
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
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test', } },
		splitLine:           ['+bTopNode'],
		expectedCompletions: ['+bTopNode.']
	});
	assertReplCompletions({ completer,
		label:               'all second level nodes',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test', } },
		splitLine:           ['+bTopNode.'],
		expectedCompletions: ['+bTopNode.aSecondNode', '+bTopNode.bSecondNode'],
	});
	assertReplCompletions({ completer,
		label:               'provides completion for partial second level node',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test', } },
		splitLine:           ['+bTopNode.b'],
		expectedCompletions: ['+bTopNode.bSecondNode'],
	});
	assertReplCompletions({ completer,
		label:               'adds equals sign after full path',
		startingNewArg:      false,
		config:              { aTopNode: 'test', bTopNode: { aSecondNode: 'test', bSecondNode: 'test', } },
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
});
