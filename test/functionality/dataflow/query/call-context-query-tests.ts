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
function r(results: readonly CallContextQuerySubKindResult[], kind = 'test-kind', subkind = 'test-subkind'): QueryResultsWithoutMeta<CallContextQuery> {
	return baseResult({
		[kind]: {
			subkinds: {
				[subkind]: results
			}
		}
	});
}

/* TODO: check what happens if builtin if may be override */
// TODO: documentation
describe('Call Context Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly CallContextQuery[], expected: QueryResultsWithoutMeta<CallContextQuery>) {
		assertQuery(label(name), shell, code, query, expected);
	}
	testQuery('No Call', '1', [q(/print/)], baseResult({}));
	testQuery('No Call (Symbol)', 'print', [q(/print/)], baseResult({}));
	testQuery('No Call (Symbol)', 'print <- 3', [q(/print/)], baseResult({}));
	testQuery('No Wanted Call', 'cat()', [q(/print/)], baseResult({}));
	describe('Local Targets', () => {
		testQuery('Happy Foo(t)', 'foo <- function(){}\nfoo()', [q(/foo/)], r([{ id: 7 }]));
		testQuery('Happy Foo(t) (only local)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyLocal })], r([{ id: 7, calls: [4] }]));
		testQuery('Happy Foo(t) (only global)', 'foo <- function(){}\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyGlobal })], baseResult({}));
		testQuery('Happy Foo(t) (two local candidates)', 'if(x) { foo <- function(){} } else { foo <- function(){} }\nfoo()', [q(/foo/, { callTargets: CallTargets.OnlyLocal })], r([{ id: 21, calls: [16, 7] }]));
	});
	describe('Global Targets', () => {
		testQuery('Print calls', 'print(1)', [q(/print/)], r([{ id: 3 }]));
		testQuery('Non-Alph calls', 'x <- 2', [q(/<-/)], r([{ id: 2 }]));
		testQuery('Built-In calls', 'if(x) 3 else 2', [q(/if/)], r([{ id: 5 }]));
		testQuery('Multiple wanted Calls', 'print(1); print(2)', [q(/print/)], r([{ id: 3 }, { id: 7 }]));
		testQuery('Print calls (global)', 'print(1)', [q(/print/, { callTargets: CallTargets.OnlyGlobal })], r([{ id: 3, calls: [] }]));
		testQuery('Higher-Order Calls', 'lapply(c(1,2,3),print)', [q(/print/)], r([{ id: 10 }]));
	});
	/* TODO: normal test for maybe scope overshadow: x <- 3, f <- function() { if(y) { x <- 2; } print(x) }, f() */
	// TODO: local and global; nested calls, using quote, ...
	describe('Mixed Targets', () => {
		const code = 'if(x) { print <- function() {} }\nprint()';
		testQuery('May be local or global', code, [q(/print/)], r([{ id: 12 }]));
		testQuery('May be local or global (only local)', code, [q(/print/, { callTargets: CallTargets.OnlyLocal })], baseResult({}));
		testQuery('May be local or global (only global)', code, [q(/print/, { callTargets: CallTargets.OnlyGlobal })], baseResult({}));
	});
	describe('Linked Calls', () => {
		// with one finding its parent, and one that does not
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
