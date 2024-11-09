import { label } from '../../_helper/label';
import type { TestConfigurationWithOutput } from '../../_helper/shell';
import { assertSliced, withShell } from '../../_helper/shell';
import { makeMagicCommentHandler } from '../../../../src/reconstruct/auto-select/magic-comments';
import { describe } from 'vitest';

function withMagicComments(expectedOutput?: string): Partial<TestConfigurationWithOutput> {
	return {
		expectedOutput,
		trimOutput:   true,
		autoSelectIf: makeMagicCommentHandler()
	};
}

describe.sequential('Reconstruct with Magic Comments', withShell(shell => {
	describe('Without Comments', () => {
		assertSliced(label('full', ['local-left-assignment', 'assignments-and-bindings', 'numbers']),
			shell, 'x <- 2\ncat()\nx', ['3@x'],
			'x <- 2\nx',
			withMagicComments('[1] 2')
		);
	});
	describe('Include Next Line', () => {
		assertSliced(label('single', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, 'x <- 2\n#xxx\n# flowr@include_next_line\ncat()\nx', ['5@x'],
			'x <- 2\ncat()\nx',
			withMagicComments('[1] 2')
		);
		assertSliced(label('multiple', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, '# flowr@include_next_line\nx <- 2\n# flowr@include_next_line\ncat()\n# flowr@include_next_line\ncat()\nx', ['7@x'],
			'x <- 2\ncat()\ncat()\nx',
			withMagicComments()
		);
	});
	describe('Include This Line', () => {
		assertSliced(label('single', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, 'x <- 2\ncat() # flowr@include_this_line\nx', ['3@x'],
			'x <- 2\ncat()\nx',
			withMagicComments('[1] 2')
		);
		assertSliced(label('multiple', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, 'x <- 2# flowr@include_this_line\ncat() # flowr@include_this_line\ncat()\nx', ['4@x'],
			'x <- 2\ncat()\nx',
			withMagicComments()
		);
	});
	describe('Include Range', () => {
		assertSliced(label('single', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, '# flowr@include_start\nx <- 2\ncat()\nx\n# flowr@include_end', ['4@x'],
			'x <- 2\ncat()\nx',
			withMagicComments('[1] 2')
		);
		assertSliced(label('nesting', ['local-left-assignment', 'assignments-and-bindings', 'numbers', 'comments']),
			shell, '# flowr@include_start\nx <- 2\n# flowr@include_start\ncat()\n# flowr@include_end\ncat()\n# flowr@include_end\ncat()\nx', ['9@x'],
			'x <- 2\ncat()\ncat()\nx',
			withMagicComments()
		);
	});
}));
