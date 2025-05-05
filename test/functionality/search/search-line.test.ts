import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { assertSearch, assertSearchEnrichment } from '../_helper/search';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';
import { Enrichment } from '../../../src/search/search-executor/search-enrichers';
import { Mapper } from '../../../src/search/search-executor/search-mappers';
import { CallTargets } from '../../../src/queries/catalog/call-context-query/identify-link-to-last-call-relation';

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

	describe('From Query', () => {
		assertSearch('call-context', shell, 'if(x) { print <- function() {} }\nprint()', [12], Q.fromQuery({
			type:        'call-context',
			kind:        'test-kind',
			subkind:     'test-subkind',
			callName:    'print',
			callTargets: CallTargets.MustIncludeGlobal
		}));
	});

	describe('Enrichments', () => {
		describe('Call targets', () => {
			assertSearch('local', shell, 'func <- function(x) { x + 1 }\nfunc(7)', ['1@function'],
				Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets).select(0),
				Q.all().get(Enrichment.CallTargets).select(0),
			);
			assertSearchEnrichment('global', shell, 'cat("hello")', [{ [Enrichment.CallTargets]: { targets: ['cat'] } }], 'some', Q.all().with(Enrichment.CallTargets));
			assertSearchEnrichment('global specific', shell, 'cat("hello")', [{ [Enrichment.CallTargets]: { targets: ['cat'] } }], 'every', Q.all().with(Enrichment.CallTargets).select(1));
			// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
			assertSearch('global mapper', shell, 'cat("hello")', [],
				Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets),
				Q.all().get(Enrichment.CallTargets),
			);
		});
		describe('last call', () => {
			assertSearch('plot mapper', shell, 'plot(x)\nplot(x)\npoints(y)', ['2@plot'],
				Q.var('points').with(Enrichment.LastCall, [{ callName: 'plot' }]).map(Mapper.Enrichment, Enrichment.LastCall),
				Q.var('points').get(Enrichment.LastCall, [{ callName: 'plot' }]),
			);
		});
	});
}));
