import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { assertSearch } from '../_helper/search';

describe.sequential('flowR search', withShell(shell => {
	assertSearch('simple search for first', shell, 'x <- 1\nprint(x)', ['1@x'],
		Q.all().first(),
		Q.var('x').first(),
		Q.varInLine('x', 1).first(),
		Q.varInLine('x', 1).first().first(),
		Q.varInLine('x', 1).last()
	);
	assertSearch('simple search for second hit', shell, 'x <- x * x\nprint(x)', ['1:6'],
		Q.var('x').select(1),
		Q.var('x').index(1),
		Q.var('x').skip(1).first(),
		Q.var('x').take(2).last()
	);
}));
