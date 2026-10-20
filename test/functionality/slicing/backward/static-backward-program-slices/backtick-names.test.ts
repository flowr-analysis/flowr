import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';

describe.sequential('Backtick quoted names', withShell(shell => {
	const caps = ['name-normal', 'strings', 'newlines', 'numbers'] as const;
	describe('symbols lose their backticks', () => {
		const esc = [...caps, 'name-escaped'] as const;
		assertSliced(label('get of a backtick-defined name', [...esc, 'name-created-resolved']), shell, '`x` <- 1\nx <- 2\nget("x")', ['3@get'], 'x <- 2\nget("x")');
		assertSliced(label('get of a name with a space', [...esc, 'name-created-resolved']), shell, '`my var` <- 1\nget("my var")', ['2@get'], '`my var` <- 1\nget("my var")');
		assertSliced(label('backtick use of a string-defined name', [...esc, 'name-quoted']), shell, 'assign("x", 1)\n`x`', ['2@`x`'], 'assign("x", 1)\n`x`');
	});
	describe('strings keep their backticks', () => {
		const quoted = [...caps, 'name-quoted'] as const;
		assertSliced(label('get of a backticked string is not the symbol', [...quoted, 'name-created-resolved']), shell, 'x <- 1\nget("`x`")', ['2@get'], 'get("`x`")');
		assertSliced(label('assign of a backticked string does not define the symbol', [...quoted]), shell, 'x <- 5\nassign("`x`", 1)\nx', ['3@x'], 'x <- 5\nx');
		assertSliced(label('assign of a backticked string defines that literal name', [...quoted]), shell, 'assign("`x`", 1)\nget("`x`")', ['2@get'], 'assign("`x`", 1)\nget("`x`")');
		assertSliced(label('exists of a backticked string is not the symbol', [...quoted, 'name-created-resolved']), shell, 'x <- 1\nexists("`x`")', ['2@exists'], 'exists("`x`")');
	});
}));
