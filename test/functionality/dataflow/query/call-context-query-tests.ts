import type {
	CallContextQuery,
	CallContextQueryKindResult,
	CallContextQuerySubKindResult } from '../../../../src/queries/call-context-query/call-context-query-format';
import {
	CallTargets
} from '../../../../src/queries/call-context-query/call-context-query-format';


import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { QueryResultsWithoutMeta } from '../../../../src/queries/query';
import { BuiltIn } from '../../../../src/dataflow/environments/built-in';


/** simple query shortcut */
function q(callName: RegExp | string, c: Partial<CallContextQuery> = {}): CallContextQuery {
	return {
		type:     'call-context',
		kind:     'test-kind',
		subkind:  'test-subkind',
		callName: callName,
		...c
	};
}

function baseResult(kinds: CallContextQueryKindResult): QueryResultsWithoutMeta<CallContextQuery> {
	return {
		'call-context': {
			kinds
		}
	};
}

/** simple result shortcut */
function r(results: CallContextQuerySubKindResult[], kind = 'test-kind', subkind = 'test-subkind'): QueryResultsWithoutMeta<CallContextQuery> {
	return baseResult({
		[kind]: {
			subkinds: {
				[subkind]: results
			}
		}
	});
}

describe('Call Context Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly CallContextQuery[], expected: QueryResultsWithoutMeta<CallContextQuery>) {
		assertQuery(label(name), shell, code, query, expected);
	}
	testQuery('No Call', '1', [q(/print/)], baseResult({}));
	testQuery('No Call (Symbol)', 'print', [q(/print/)], baseResult({}));
	testQuery('No Call (Symbol, Definition)', 'print <- 3', [q(/print/)], baseResult({}));
	testQuery('Unwanted Call', 'cat()', [q(/print/)], baseResult({}));
	testQuery('Quoted Call', 'quote(print())', [q(/print/)], baseResult({}));
	testQuery('Do call', 'do.call("print")', [q(/print/)], r([{ id: 1 }]));
	describe('Local Targets', () => {
		testQuery('Happy Foo(t)', 'foo <- function(){}\nfoo()', [q(/foo/)], r([{ id: 7 }]));
		testQuery('Happy Foo(t) (only local)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyLocal })], r([{ id: 7, calls: [4] }]));
		testQuery('Happy Foo(t) (incl. local)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.MustIncludeLocal })], r([{ id: 7, calls: [4] }]));
		testQuery('Happy Foo(t) (only global)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyGlobal })], baseResult({}));
		testQuery('Happy Foo(t) (incl. global)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.MustIncludeGlobal })], baseResult({}));
		testQuery('Happy Foo(t) (two local candidates)', 'if(x) { foo <- function(){} } else { foo <- function(){} }\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyLocal })], r([{ id: 21, calls: [16, 7] }]));
		testQuery('Nested Calls', 'foo <- function() { bar <- function() {}; bar() }\nfoo()', [q(/bar/)], r([{ id: 10 }]));
	});
	describe('Global Targets', () => {
		testQuery('Print calls', 'print(1)', [q(/print/)], r([{ id: 3 }]));
		testQuery('Non-Alph calls', 'x <- 2', [q(/<-/)], r([{ id: 2 }]));
		testQuery('Built-In calls', 'if(x) 3 else 2', [q(/if/)], r([{ id: 5 }]));
		testQuery('Multiple wanted Calls', 'print(1); print(2)', [q(/print/)], r([{ id: 3 }, { id: 7 }]));
		testQuery('Print calls (global)', 'print(1)', [q(/print/, { callTargets: CallTargets.OnlyGlobal })], r([{ id: 3, calls: [BuiltIn] }]));
		testQuery('Higher-Order Calls', 'lapply(c(1,2,3),print)', [q(/print/)], r([{ id: 10 }]));
		testQuery('Reading non-built-ins', 'read_csv(x)', [q(/read_csv/, { callTargets: CallTargets.OnlyGlobal })], r([{ id: 3, calls: [] }]));
		testQuery('Built-In in Argument', 'print(mean(x))', [q(/mean/, { callTargets: CallTargets.OnlyGlobal })], r([{ id: 4, calls: [BuiltIn] }]));
		testQuery('Multiple Built-In in Argument', 'mean(y)\nprint(mean(x))', [q(/mean/, { callTargets: CallTargets.OnlyGlobal })], r([{ id: 3, calls: [BuiltIn] }, { id: 8, calls: [BuiltIn] }]));
	});
	describe('Mixed Targets', () => {
		const code = 'if(x) { print <- function() {} }\nprint()';
		testQuery('May be local or global', code, [q(/print/)], r([{ id: 12 }]));
		testQuery('May be local or global (only local)', code, [q(/print/, { callTargets: CallTargets.OnlyLocal })], baseResult({}));
		testQuery('May be local or global (incl. local)', code, [q(/print/, { callTargets: CallTargets.MustIncludeLocal })], r([{ id: 12, calls: [7, BuiltIn] }]));
		testQuery('May be local or global (only global)', code, [q(/print/, { callTargets: CallTargets.OnlyGlobal })], baseResult({}));
		testQuery('May be local or global (incl. global)', code, [q(/print/, { callTargets: CallTargets.MustIncludeGlobal })], r([{ id: 12, calls: [7, BuiltIn] }]));
	});
	describe('Linked Calls', () => {
		testQuery('Link to Plot', 'plot(x)\nplot(x)\npoints(y)', [q(/points/, { linkTo: { type: 'link-to-last-call', callName: /plot/ } })], r([{ id: 11, linkedIds: [7] }]));
		testQuery('Link to Self', 'plot(x)\nplot(y)', [q(/plot/, { linkTo: { type: 'link-to-last-call', callName: /plot/ } })], r([{ id: 3, linkedIds: [] }, { id: 7, linkedIds: [3] }]));
		testQuery('Link to Meet', 'if(k) { plot(a) } else { plot(x) }\npoints(y)', [q(/points/, { linkTo: { type: 'link-to-last-call', callName: /plot/ } })], r([{ id: 19, linkedIds: [13, 6] }]));
		testQuery('Link to Loop Closure ', 'for(i in v) { points(a); plots(b) }', [q(/points/, { linkTo: { type: 'link-to-last-call', callName: /plot/ } })], r([{ id: 7, linkedIds: [11] }]));
	});
	describe('Aliases', () => {
		testQuery('Alias without inclusion', 'foo <- print\nfoo()', [q(/print/)], baseResult({}));
		testQuery('No alias with inclusion', 'foo <- print\nprint()', [q(/print/, { includeAliases: true })], r([{ id: 3 }]));
		testQuery('Alias with inclusion', 'foo <- print\nfoo()', [q(/print/, { includeAliases: true })], r([{ id: 3, aliasedAt: [7] }]));
		testQuery('Two level alias', 'foo <- print\nbar <- foo\nbar()', [q(/print/, { includeAliases: true })], r([{ id: 3 }]));
		testQuery('Multiple aliases', 'foo <- print\nbar <- print\nfoo()\nbar()', [q(/print/, { includeAliases: true })], r([{ id: 3 }, { id: 7 }]));
		testQuery('Multiple potential aliases', 'if(u) foo <- print else foo <- print\nfoo()', [q(/print/, { includeAliases: true })], r([{ id: 3, aliasedAt: [1, 2] }]));
		testQuery('Alias by return', 'f <- function() print\nx <- f()\nx()', [q(/print/, { includeAliases: true })], r([{ id: 3, aliasedAt: [7] }]));
		testQuery('Alias by side effect', 'f <- function() x <<- print\nx()', [q(/print/, { includeAliases: true })], r([{ id: 3, aliasedAt: [9] }]));
		testQuery('Alias by parameter', 'f <- function(p) { p() }\nf(print)', [q(/print/, { includeAliases: true })], r([{ id: 3, aliasedAt: [3] }]));
		testQuery('Alias another function', 'f <- bar\nf()', [q(/print/, { includeAliases: true })], baseResult({}));
	});
	describe('Multiple Kinds', () => {
		testQuery('Multiple Kinds', 'print(1); foo(2)', [q(/print/, { kind: 'print-kind' }), q(/foo/, { kind: 'foo-kind' })], baseResult({
			'print-kind': { subkinds: { 'test-subkind': [{ id: 3 }] } },
			'foo-kind':   { subkinds: { 'test-subkind': [{ id: 7 }] } }
		}));
	});
	describe('Multiple Sub-Kinds', () => {
		testQuery('Multiple Sub-Kinds', 'print(1); foo(2)', [q(/print/, { subkind: 'print-subkind' }), q(/foo/, { subkind: 'foo-subkind' })], baseResult({
			'test-kind': {
				subkinds: {
					'print-subkind': [{ id: 3 }],
					'foo-subkind':   [{ id: 7 }]
				}
			}
		}));
	});
}));
