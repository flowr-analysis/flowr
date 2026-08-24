import { describe } from 'vitest';
import { assumeLoadedPackages, withTreeSitter } from '../_helper/shell';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { assertSearch, assertSearchEnrichment } from '../_helper/search';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilter } from '../../../src/search/flowr-search-filters';
import { type CfgInformationArguments, Enrichment } from '../../../src/search/search-executor/search-enrichers';
import { Mapper } from '../../../src/search/search-executor/search-mappers';
import { CallTargets } from '../../../src/queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { BuiltInProcName } from '../../../src/dataflow/environments/built-in-proc-name';
import type { CallProps } from '../../../src/dataflow/environments/built-in-props';
import { CallProp } from '../../../src/dataflow/environments/built-in-props';

assumeLoadedPackages('svDialogs');

describe('flowR search', withTreeSitter(parser => {
	assertSearch('simple search for first', parser, 'x <- 1\nprint(x)', ['1@x'],
		Q.all().first(),
		Q.var('x').first(),
		Q.varInLine('x', 1).first(),
		Q.varInLine('x', 1).first().first(),
		Q.varInLine('x', 1).last()
	);
	assertSearch('simple search for second hit', parser, 'x <- x * x\nprint(x)', ['1@[2]x'],
		Q.varInLine('x', 1).select(1),
		Q.var('x').select(1),
		Q.var('x').index(1),
		Q.var('x').skip(1).first(),
		Q.var('x').take(2).last(),
		Q.var('x').take(2).tail()
	);
	assertSearch('multiple hits', parser, 'x <- x * x\nprint(x)', ['1@[2]x', '2@x'],
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

	describe('picking from an empty set', () => {
		assertSearch('no element to pick', parser, 'x <- 1\nprint(x)\nprint(2)', [],
			Q.all().filter(RType.Break).first(),
			Q.all().filter(RType.Break).last(),
			Q.all().filter(RType.Break).index(0),
			Q.all().filter(RType.Break).index(3)
		);
		assertSearch('index out of range', parser, 'x <- 1\nprint(x)\nprint(2)', [],
			Q.all().filter(RType.FunctionCall).index(7)
		);
		assertSearch('still picks the first when there is something to pick', parser, 'x <- 1\nprint(x)\nprint(2)', ['2@print'],
			Q.all().filter(RType.FunctionCall).first(),
			Q.all().filter(RType.FunctionCall).index(0)
		);
		assertSearch('still picks the last when there is something to pick', parser, 'x <- 1\nprint(x)\nprint(2)', ['3@print'],
			Q.all().filter(RType.FunctionCall).last(),
			Q.all().filter(RType.FunctionCall).index(1)
		);
	});

	describe('unique', () => {
		assertSearch('drops only the duplicates', parser, 'x <- 1\nprint(x)\nprint(2)', ['2@print', '3@print'],
			Q.all().filter(RType.FunctionCall).merge(Q.all().filter(RType.FunctionCall)).unique(),
			Q.all().filter(RType.FunctionCall).merge(Q.all().filter(RType.FunctionCall)).merge(Q.all().filter(RType.FunctionCall)).unique()
		);
		assertSearch('keeps a set without duplicates', parser, 'x <- 1\nprint(x)\nprint(2)', ['2@print', '3@print'],
			Q.all().filter(RType.FunctionCall).unique(),
			Q.all().filter(RType.FunctionCall).unique().unique()
		);
	});

	describe('Filters', () => {
		describe('matches enrichment', () => {
			assertSearch('call-targets (none)', parser, "cat('hello')\nprint('world')", [],
				Q.all().filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       {
						targets: /^print$/
					}
				} })
			);
			assertSearch('call-targets (other)', parser, "cat('hello')\nprint('world')", [],
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       {
						targets: /^library$/
					}
				} })
			);
			assertSearch('call-targets (match)', parser, "cat('hello')\nprint('world')", ['2@print'],
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       {
						targets: /print/
					}
				} })
			);
		});
		describe('origin', () => {
			assertSearch('default', parser, 'x <- 2\ncat(x)', ['2@cat'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.Default } })
			);
			assertSearch('literal assignment', parser, 'x <- 2\ncat(x)', ['1@<-'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.Assignment } })
			);
			assertSearch('include function calls', parser, 'x <- 2\ncat(x)', ['1@<-', '1@x', '1@2', '2@x', '$3', '$5', '$7'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.Assignment, keepNonFunctionCalls: true } })
			);
			assertSearch('regex assignment', parser, 'x <- 2\ncat(x)', ['1@<-'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: /:assign/ } })
			);
			assertSearch('for loop', parser, "for (i in 1:10) { cat('hi') }", ['1@for'],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.ForLoop } })
			);
			assertSearch('for loop (overridden)', parser, "for <- function() {}; for (i in 1:10) { cat('hi') }", [],
				Q.all().filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.ForLoop } })
			);
		});
		/* what a call is, rather than what it is called, so that no consumer has to keep a list of names */
		describe('call properties', () => {
			const carrying = (props: CallProps, matchType?: 'some' | 'every') =>
				Q.all().filter({ name: FlowrFilter.CallProps, args: { props, matchType } });
			const code = 'pdf("a.pdf")\nplot(1)\ndev.off()\nsetwd("/tmp")\nx <- readline("give: ")\nprint(1)';

			assertSearch('asks the user', parser, code, ['5@readline'], carrying(CallProp.User));
			assertSearch('closes a device', parser, code, ['3@dev.off'], carrying(CallProp.Closes));
			assertSearch('sets ambient state', parser, code, ['4@setwd'], carrying(CallProp.Configures));
			assertSearch('any of several properties', parser, code, ['3@dev.off', '4@setwd'], carrying(CallProp.Closes | CallProp.Configures));
			assertSearch('every one of them', parser, code, ['3@dev.off'], carrying(CallProp.Closes | CallProp.Graphics, 'every'));
			/* a definition in the analyzed code shadows the built-in, so the call is no longer the one we labelled */
			assertSearch('a shadowed built-in states nothing', parser, 'readline <- function(...) "x"\nreadline("give: ")', [], carrying(CallProp.User));
			/* the call happens before that definition, so it is still the built-in that runs */
			assertSearch('a redefinition afterwards does not speak for it', parser, 'readline("give: ")\nreadline <- function(...) "x"', ['1@readline'], carrying(CallProp.User));
			/* attaching a package binds its exports itself, which must not hide what flowR states about them */
			assertSearch('a call of an attached package', parser, 'library(svDialogs)\nx <- dlgInput("give: ")', ['2@dlgInput'], carrying(CallProp.User));
			assertSearch('the same call namespaced', parser, 'x <- svDialogs::dlgInput("give: ")', ['1@svDialogs::dlgInput'], carrying(CallProp.User));
		});
		describe('file path', () => {
			assertSearch('filter by file path with RegExp', parser,
				[
					{ request: 'file', content: 'test/testfiles/parse-multiple/a.R' },
					{ request: 'file', content: 'test/testfiles/parse-multiple/b.R' }
				],
				(result) => result.length > 0 && result.every(r => r.node.info.file?.endsWith('a.R')),
				Q.all().filter({ name: FlowrFilter.FilePathFilter, args: { filePathRegex: /a\.R$/ } })
			);
			assertSearch('excludes non-matching file paths', parser,
				[
					{ request: 'file', content: 'test/testfiles/parse-multiple/a.R' },
					{ request: 'file', content: 'test/testfiles/parse-multiple/b.R' }
				],
				(result) => !result.some(r => r.node.info.file?.endsWith('b.R')),
				Q.all('a\\.R$')
			);
			assertSearch('non-matching file path returns empty', parser,
				[
					{ request: 'file', content: 'test/testfiles/parse-multiple/a.R' },
					{ request: 'file', content: 'test/testfiles/parse-multiple/b.R' }
				],
				[],
				Q.all('nonexistent\\.R$')
			);
			assertSearch('inline code matches empty file path regex', parser,
				'x <- 1',
				(result) => result.length > 0,
				Q.all('^$')
			);
		});
	});

	describe('Fuzzy loc', () => {
		assertSearch('variable at interior column', parser, 'x <- abcd', (result) => result.length >= 1 && result.some(r => r.node.lexeme === 'abcd'),
			Q.locFuzzy(1, 6),
			Q.locFuzzy(1, 7),
			Q.locFuzzy(1, 8),
			Q.locFuzzy(1, 9)
		);
		assertSearch('string literal interior', parser, 'x <- "hello"', (result) => result.some(r => r.node.lexeme === '"hello"'),
			Q.locFuzzy(1, 8),
			Q.locFuzzy(1, 9),
			Q.locFuzzy(1, 10)
		);
		assertSearch('backtick identifier', parser, 'x <- `my var`', (result) => result.some(r => r.node.lexeme === '`my var`'),
			Q.locFuzzy(1, 7),
			Q.locFuzzy(1, 8),
			Q.locFuzzy(1, 9),
			Q.locFuzzy(1, 10)
		);
		assertSearch('position outside range', parser, 'x <- abcd', [],
			Q.locFuzzy(1, 15)
		);
		assertSearch('comment position (no nodes)', parser, '# comment amazing\nx <- 1', [],
			Q.locFuzzy(1, 3),
			Q.locFuzzy(1, 5)
		);
		assertSearch('multiline: if expression envelopes variable (default returns all)', parser, 'if(x) { abcd }',
			(result) => result.length >= 2, // at least if and abcd or other enveloping nodes
			Q.locFuzzy(1, 11)
		);
		assertSearch('multiline: if expression with innermostOnly', parser, 'if(x) { abcd }', (result) => result.some(r => r.node.lexeme === 'abcd') && result.length === 1,
			Q.locFuzzy(1, 11, true)
		);
		assertSearch('complex nesting with innermostOnly', parser, 'if(x) { y <- func(z) }', (result) => result.some(r => r.node.lexeme === 'z') && result.length === 1,
			Q.locFuzzy(1, 19, true)
		);
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
			assertSearch('string', parser, 'x <- "hello"', ['1@"hello"'], Q.syntax('(string)'));
			assertSearch('number', parser, 'x <- 2', ['1@2'], Q.syntax('(float)'));
			assertSearch('identifier', parser, 'x <- 2', ['1@x'], Q.syntax('(identifier)'));
			assertSearch('assignment', parser, 'x <- 2; y = 7', ['1@<-', '1@='], Q.syntax('(binary_operator)'));
			assertSearch('<-', parser, 'x <- 2; y = 7', ['1@<-'], Q.syntax('(binary_operator operator: "<-")'));

			describe('multiple', () => {
				assertSearch('identifier', parser, 'x <- 2; y <- 17\ncat(y)', ['1@x', '1@y', '2@y'], Q.syntax('(identifier)'));
			});
		});

		describe('custom capture', () => {
			assertSearch('correct capture', parser, 'x <- "hello"', ['1@"hello"'], Q.syntax('(string) @s', 's'));
			assertSearch('capture with @', parser, 'x <- "hello"', ['1@"hello"'], Q.syntax('(string) @s', '@s'));
			assertSearch('incorrect capture', parser, 'x <- "hello"', [], Q.syntax('(string) @s', 'k'));

			describe('multiple', () => {
				assertSearch('binary op', parser, 'x <- 2\ny <- 17\ncat(y)', ['1@<-', '2@<-', '1@x', '2@y'], Q.syntax('(binary_operator lhs: (identifier) @id) @op', 'op', 'id'));
			});
		});

		describe('reuse queries', () => {
			const query = parser.createQuery('(string) @s');
			assertSearch('first', parser, 'x <- "hello"', ['1@"hello"'], Q.syntax(query, 's'));
			assertSearch('second', parser, 'x <- 1', [], Q.syntax(query, 's'));
			assertSearch('third', parser, 'x <- "world"', ['1@"world"'], Q.syntax(query, 's'));
		});

		describe('filtered query', () => {
			assertSearch('builtin assignment', parser, '`<-` <- function() {}\nx <- 2; y = 7', ['1@<-', '2@='],
				Q.syntax('(binary_operator)').filter({ name: FlowrFilter.OriginKind, args: { origin: BuiltInProcName.Assignment } }));
			assertSearch('number assignment', parser, 'x <- 2; y <- "hello"', ['1@2'],
				Q.syntax('(binary_operator rhs: (_) @rhs)', 'rhs').filter(RType.Number));
		});
	});

	describe('Enrichments', () => {
		describe('call targets', () => {
			assertSearch('local', parser, 'func <- function(x) { x + 1 }\nfunc(7)', ['1@function'],
				Q.all().with(Enrichment.CallTargets).map(Mapper.Enrichment, Enrichment.CallTargets).select(0),
				Q.all().to(Enrichment.CallTargets).select(0),
			);
			assertSearch('local multiple', parser, 'f1 <- function() {}\nf2 <- function() {}\n f1(); f2()', ['1@function'],
				Q.all().with(Enrichment.CallTargets).filter({ name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CallTargets,
					test:       {
						targets: {
							node: {
								info: {
									id: 4
								}
							}
						}
					}
				} }).map(Mapper.Enrichment, Enrichment.CallTargets)
			);
			assertSearchEnrichment('global', parser, 'cat("hello")',
				[{ [Enrichment.CallTargets]: { targets: ['base::cat'] } }], 'some',
				Q.all().with(Enrichment.CallTargets));
			assertSearchEnrichment('global specific', parser, 'cat("hello")',
				[{ [Enrichment.CallTargets]: { targets: ['base::cat'] } }], 'every',
				Q.all().with(Enrichment.CallTargets).select(1));
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
					test:       {
						isReachable: true
					}
				}
			}));
			assertSearch('reachable never', parser, 'if(FALSE) 1 else 2', ['1@if', '1@FALSE', '1@2', '$4', '$6'], Q.all().with(Enrichment.CfgInformation, cfgArgs).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       {
						isReachable: /true/
					}
				}
			}));
			assertSearch('reachable no dead code', parser, 'if(FALSE) 1 else 2', [], Q.all().with(Enrichment.CfgInformation).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       {
						isReachable: false
					}
				}
			}));
			assertSearch('reachable no reachable', parser, 'if(FALSE) 1 else 2', [], Q.all().with(Enrichment.CfgInformation).filter({
				name: FlowrFilter.MatchesEnrichment, args: {
					enrichment: Enrichment.CfgInformation,
					test:       {
						isReachable: /false/
					}
				}
			}));
		});
	});
}));
