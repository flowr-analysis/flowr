import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { assertSearch } from '../_helper/search';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';

describe.sequential('flowR search', withShell(shell => {
	assertSearch('simple search for first', shell, 'x <- 1\nprint(x)', ['1@x'],
		Q.all().first(),
		Q.var('x').first(),
		Q.varInLine('x', 1).first(),
		Q.varInLine('x', 1).first().first(),
		Q.varInLine('x', 1).last()
	);
	assertSearch('simple search for second hit', shell, 'x <- x * x\nprint(x)', ['1:6'],
		Q.varInLine('x', 1).select(1),
		Q.var('x').select(1),
		Q.var('x').index(1),
		Q.var('x').skip(1).first(),
		Q.var('x').take(2).last(),
		Q.var('x').take(2).tail()
	);
	assertSearch('multiple hits', shell, 'x <- x * x\nprint(x)', ['1:6', '2@x'],
		Q.var('x').select(1).merge(Q.varInLine('x', 2).filter(FlowrFilter.DropEmptyArguments).first()),
		Q.var('x').filter(FlowrFilter.DropEmptyArguments).select(1, 3),
		Q.var('x').take(2).last().merge(Q.var('x').filter(FlowrFilter.DropEmptyArguments).last()),
		Q.var('x').take(2).merge(Q.var('x').filter(FlowrFilter.DropEmptyArguments).last()).filter(VertexType.Use)
	);
	assertSearch('big code', shell, 'x <- x * x\nprint(x)\n'.repeat(50), ['100@x'],
		Q.varInLine('x', -1).filter(VertexType.Use).last(),
		Q.var('x').filter(VertexType.Use).last(),
		Q.var('x').filter(VertexType.Use).tail().last(),
	);
	assertSearch('with enrichment', shell, 'func <- function(x) { x + 1 }\nfunc(7)', ['1@func'],
		// TODO mappers don't exist yet
		/*Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets).first()*/
	);
}));
