import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { assertSearch, assertSearchEnrichment } from '../_helper/search';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';
import type { CfgInformationArguments } from '../../../src/search/search-executor/search-enrichers';
import { Enrichment } from '../../../src/search/search-executor/search-enrichers';
import { Mapper } from '../../../src/search/search-executor/search-mappers';
import { CallTargets } from '../../../src/queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

describe('flowR search', withTreeSitter(parser => {
	assertSearch('simple search for first', parser, 'x <- 1\nprint(x)', ['1@x'],
		Q.all().first(),
		Q.var('x').first(),
		Q.varInLine('x', 1).first(),
		Q.varInLine('x', 1).first().first(),
		Q.varInLine('x', 1).last()
	);
	assertSearch('simple search for second hit', parser, 'x <- x * x\nprint(x)', ['1:6'],
		Q.varInLine('x', 1).select(1),
		Q.var('x').select(1),
		Q.var('x').index(1),
		Q.var('x').skip(1).first(),
		Q.var('x').take(2).last(),
		Q.var('x').take(2).tail()
	);
	assertSearch('multiple hits', parser, 'x <- x * x\nprint(x)', ['1:6', '2@x'],
		Q.var('x').select(1).merge(Q.varInLine('x', 2).filter(FlowrFilter.DropEmptyArguments).first()),
		Q.var('x').filter(FlowrFilter.DropEmptyArguments).select(1, 3),
		Q.var('x').take(2).last().merge(Q.var('x').filter(FlowrFilter.DropEmptyArguments).last()),
		Q.var('x').take(2).merge(Q.var('x').filter(FlowrFilter.DropEmptyArguments).last()).filter(VertexType.Use)
	);
	assertSearch('big code', parser, 'x <- x * x\nprint(x)\n'.repeat(50), ['100@x'],
		Q.varInLine('x', -1).filter(VertexType.Use).last(),
		Q.var('x').filter(VertexType.Use).last(),
		Q.var('x').filter(VertexType.Use).tail().last(),
	);

	describe('Filters', () => {
		describe('matches enrichment', () => {
			assertSearch('call-targets (none)', parser, "cat('hello')\nprint('world')", [],
				Q.all().filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       /"print"/
				} })
			);
			assertSearch('call-targets (other)', parser, "cat('hello')\nprint('world')", [],
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       /"library"/
				} })
			);
			assertSearch('call-targets (match)', parser, "cat('hello')\nprint('world')", ['2@print'],
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       /"print"/
				} })
			);
		});
		describe('origin', () => {
			assertSearch('default', parser, 'x <- 2\ncat(x)', ['2@cat'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: 'builtin:default' } })
			);
			assertSearch('literal assignment', parser, 'x <- 2\ncat(x)', ['1@<-'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: 'builtin:assignment' } })
			);
			assertSearch('include function calls', parser, 'x <- 2\ncat(x)', ['1@<-', '1@x', '1@2', '2@x', '$3', '$5', '$7'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: 'builtin:assignment', keepNonFunctionCalls: true } })
			);
			assertSearch('regex assignment', parser, 'x <- 2\ncat(x)', ['1@<-'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: /:assignment/ } })
			);
			assertSearch('for loop', parser, "for (i in 1:10) { cat('hi') }", ['1@for'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: 'builtin:for-loop' } })
			);
			assertSearch('for loop (overridden)', parser, "for <- function() {}; for (i in 1:10) { cat('hi') }", [],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: 'builtin:for-loop' } })
			);
		});
	});

	describe('From Query', () => {
		assertSearch('call-context', parser, 'if(x) { print <- function() {} }\nprint()', [12], Q.fromQuery({
			type:        'call-context',
			kind:        'test-kind',
			subkind:     'test-subkind',
			callName:    'print',
			callTargets: CallTargets.MustIncludeGlobal
		}));
	});

	describe('From Tree-Sitter Query', () => {
		describe('simple', () => {
			assertSearch('string', parser, 'x <- "hello"', ['1@"hello"'], Q.fromTreeSitterQuery('(string)'));
			assertSearch('number', parser, 'x <- 2', ['1@2'], Q.fromTreeSitterQuery('(float)'));
			assertSearch('identifier', parser, 'x <- 2', ['1@x'], Q.fromTreeSitterQuery('(identifier)'));
			assertSearch('assignment', parser, 'x <- 2; y = 7', ['1@<-', '1@='], Q.fromTreeSitterQuery('(binary_operator)'));
			assertSearch('<-', parser, 'x <- 2; y = 7', ['1@<-'], Q.fromTreeSitterQuery('(binary_operator operator: "<-")'));

			describe('multiple', () => {
				assertSearch('identifier', parser, 'x <- 2; y <- 17\ncat(y)', ['1@x', '1@y', '2@y'], Q.fromTreeSitterQuery('(identifier)'));
			});
		});

		describe('custom capture', () => {
			assertSearch('string', parser, 'x <- "hello"', ['1@"hello"'], Q.fromTreeSitterQuery('(string)'));
			assertSearch('correct capture', parser, 'x <- "hello"', ['1@"hello"'], Q.fromTreeSitterQuery('(string) @s', 's'));
			assertSearch('incorrect capture', parser, 'x <- "hello"', [], Q.fromTreeSitterQuery('(string) @s', 'k'));

			describe('multiple', () => {
				assertSearch('binary op', parser, 'x <- 2\ny <- 17\ncat(y)', ['1@<-', '2@<-', '1@x', '2@y'], Q.fromTreeSitterQuery('(binary_operator lhs: (identifier) @id) @op', 'op', 'id'));
			});
		});
	});

	describe('Enrichments', () => {
		describe('call targets', () => {
			assertSearch('local', parser, 'func <- function(x) { x + 1 }\nfunc(7)', ['1@function'],
				Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets).select(0),
				Q.all().to(Enrichment.CallTargets).select(0),
			);
			assertSearchEnrichment('global', parser, 'cat("hello")', [{ [Enrichment.CallTargets]: { targets: ['cat'] } }], 'some', Q.all().with(Enrichment.CallTargets));
			assertSearchEnrichment('global specific', parser, 'cat("hello")', [{ [Enrichment.CallTargets]: { targets: ['cat'] } }], 'every', Q.all().with(Enrichment.CallTargets).select(1));
			// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
			assertSearch('global mapper', parser, 'cat("hello")', [],
				Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets),
				Q.all().to(Enrichment.CallTargets),
			);
		});
		describe('last call', () => {
			assertSearch('plot mapper', parser, 'plot(x)\nplot(x)\npoints(y)', ['2@plot'],
				Q.var('points').with(Enrichment.LastCall, [{ callName: 'plot' }]).map(Mapper.Enrichment, Enrichment.LastCall),
				Q.var('points').to(Enrichment.LastCall, [{ callName: 'plot' }]),
			);
		});
		describe('cfg info', () => {
			const cfgArgs: CfgInformationArguments = {
				checkReachable:       true,
				simplificationPasses: [...DefaultCfgSimplificationOrder, 'analyze-dead-code'],
			};
			assertSearch('reachable always', parser, 'if(TRUE) 1 else 2', ['1@if', '1@TRUE', '1@1', '$2', '$6'], Q.all().with(Enrichment.CfgInformation, cfgArgs).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       /"isReachable":true/
				}
			}));
			assertSearch('reachable never', parser, 'if(FALSE) 1 else 2', ['1@if', '1@FALSE', '1@2', '$4', '$6'], Q.all().with(Enrichment.CfgInformation, cfgArgs).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       /"isReachable":true/
				}
			}));
			assertSearch('reachable no dead code', parser, 'if(FALSE) 1 else 2', [], Q.all().with(Enrichment.CfgInformation).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       /"isReachable":false/
				}
			}));
			assertSearch('reachable no reachable', parser, 'if(FALSE) 1 else 2', [], Q.all().with(Enrichment.CfgInformation).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       /"isReachable":false/
				}
			}));
		});
	});
}));
