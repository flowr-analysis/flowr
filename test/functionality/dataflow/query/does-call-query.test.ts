import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type {
	CallsConstraint,
	DoesCallQuery,
	DoesCallQueryResult
} from '../../../../src/queries/catalog/does-call-query/does-call-query-format';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { DeepWritable } from 'ts-essentials';

describe('Does Call Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, rawQueries: readonly Omit<DoesCallQuery, 'type'> [], results: readonly (SingleSlicingCriterion|false)[]) {
		let i = 0;
		const query: DoesCallQuery[] = [];
		for(const rq of rawQueries) {
			const q = rq as DeepWritable<DoesCallQuery>;
			q.type = 'does-call';
			if(!q.queryId) {
				(q as DeepWritable<typeof q>).queryId = String(++i);
			}
			query.push(q as DoesCallQuery);
		}
		// TODO: add index to the respective query as id, accept an array of findings with either an id or a boolean
		assertQuery(label(name), parser, code, query, (info) => {
			const idMap = info.normalize.idMap;
			const expectedResults: DoesCallQueryResult['results'] = {};
			let i = 0;
			for(const v of results) {
				expectedResults[String(++i)] = v === false ? false : { call: slicingCriterionToId(v, idMap) };
			}
			return {
				'does-call': {
					results: expectedResults
				}
			};
		});
	}
	const n = (name: string) => ({ type: 'name', name, nameExact: true } as const);
	const r = (name: string) => ({ type: 'name', name, nameExact: false } as const);
	const and = (...calls: readonly CallsConstraint[]) => ({ type: 'and', calls } as const);
	const or = (...calls: readonly CallsConstraint[]) => ({ type: 'or', calls } as const);

	testQuery('Calling eval (named & regex)', 'f <- function(x) { eval(x) }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '1@function',  calls: r('eval') },
		{ call: '2@f',  calls: n('eval') },
		{ call: '2@f',  calls: r('eval') },
		{ call: '1@eval',  calls: n('eval') },
		{ call: '1@eval',  calls: r('eval') }
	], ['1@function', '1@function', '2@f', '2@f', '1@eval', '1@eval']);

	testQuery('Not calling eval (named & regex)', 'f <- function(x) { rofl(x) }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '1@function',  calls: r('eval') },
		{ call: '2@f',  calls: n('eval') },
		{ call: '2@f',  calls: r('eval') },
		{ call: '1@rofl',  calls: n('eval') },
		{ call: '1@rofl',  calls: r('eval') }
	], [false, false, false, false, false, false]);

	testQuery('Calling eval with indirection', 'g <- function() { if(u) { eval(x) } }\nf <- function(x) { g() }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '2@function',  calls: n('eval') },
		{ call: '3@f',  calls: n('eval') },
	], ['1@function', '2@function', '3@f']);

	testQuery('Not calling eval because dead code', 'g <- function() { if(FALSE) { eval(x) } }\nf <- function(x) { g() }\nf(1)', [
		{ call: '1@function',  calls: n('eval') },
		{ call: '2@function',  calls: n('eval') },
		{ call: '3@f',  calls: n('eval') },
	], [false, false, false]);

	for(const fname of ['eval', '*', 'quote', 'rofl']) {
		testQuery(`Calling '${fname}' with alias`, `g <- ${fname === '*' ? `\`${fname}\`` : fname}\nf <- function(x) { g(x) }\nf(1)`, [
			{ call: '1@g', calls: n(fname) },
			{ call: '2@g', calls: n(fname) },
			{ call: '2@function', calls: n(fname) },
			{ call: '3@f', calls: n(fname) },
		], [false, '2@g', '2@function', '3@f']);
	}

	const threeCalls = and(n('eval'), n('<-'), r('^foo|bar$'));
	const anyOfThreeCalls = or(n('eval'), n('<-'), r('^foo|bar$'));
	for(const [constr, result] of [
		[threeCalls, ['1@function', false, false, false, false, '6@function', '7@function', '8@function', '9@function', '10@function']],
		[anyOfThreeCalls, ['1@function', '2@function', '3@function', '4@function', false, '6@function', '7@function', '8@function', '9@function', '10@function']]
	] as const) {
		testQuery('Must have three calls!', `allInOne <- function() { foo <- 1; eval(parse(text="bar(foo)")) }
       onlyTwosA <- function() { foo <- 2; bar(foo) } # no eval
       onlyTwosB <- function() { foo <- 2; eval(parse(text="baz(foo)")) } # no bar|foo call
       onlyTwosC <- function() { foo = 2; eval(x); foo(3) } # no <- call
       none <- function() { baz(3) } # no eval, <-, foo, or bar
       combineAB <- function() { onlyTwosA(); onlyTwosB() }
       combineAC <- function() { onlyTwosA(); onlyTwosC() }
       combineBC <- function() { onlyTwosB(); onlyTwosC() }
       allThree <- function() { allInOne() }
       combineABC <- function() { onlyTwosA(); onlyTwosB(); onlyTwosC() }
	`, [
			{ call: '1@function',  calls: constr }, // allInOne
			{ call: '2@function',  calls: constr }, // onlyTwosA
			{ call: '3@function',  calls: constr }, // onlyTwosB
			{ call: '4@function',  calls: constr }, // onlyTwosC
			{ call: '5@function',  calls: constr }, // none
			{ call: '6@function',  calls: constr }, // combineAB
			{ call: '7@function',  calls: constr }, // combineAC
			{ call: '8@function',  calls: constr }, // combineBC
			{ call: '9@function',  calls: constr }, // allThree
			{ call: '10@function', calls: constr } // combineABC
		], result);
	}
}));
