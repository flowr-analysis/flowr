import { assert, describe, test } from 'vitest';
import { label } from '../../_helper/label';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import type { CallGraphQuery } from '../../../../src/queries/catalog/call-graph-query/call-graph-query-format';

const askForUnreachable: CallGraphQuery = { type: 'call-graph', reportUnreachable: true };

describe('Call Graph Query', withTreeSitter(parser => {
	/** what the query reports for `code`, with a membership test by criterion so assertions read as source positions */
	async function unreachableIn(code: string, query: CallGraphQuery = askForUnreachable) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		const { idMap } = await analyzer.normalize();
		const reported = (await analyzer.query([query]))['call-graph'].unreachable;
		const ids = new Set(reported);
		return { reported, holds: (c: SlicingCriterion) => ids.has(SlicingCriterion.parse(c, idMap)) };
	}

	/** asserts that every criterion of `unreachable` is reported and every one of `reachable` is not */
	function testReachability(name: string, code: string, expected: { unreachable?: SlicingCriterion[], reachable?: SlicingCriterion[] }) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const { holds } = await unreachableIn(code);
			for(const criterion of expected.unreachable ?? []) {
				assert.isTrue(holds(criterion), `${criterion} should be unreachable`);
			}
			for(const criterion of expected.reachable ?? []) {
				assert.isFalse(holds(criterion), `${criterion} should be reachable`);
			}
		});
	}

	testReachability('a write in a function nothing calls produces no file',
		'batch <- function() {\n  write.csv(d, "out.csv")\n}\nprint("done")',
		{ unreachable: ['2@write.csv'], reachable: ['4@print'] });
	testReachability('a call reached through another function counts as reachable',
		'helper <- function() write.csv(d, "out.csv")\nrun <- function() helper()\nrun()',
		{ reachable: ['1@write.csv', '2@helper', '3@run'] });
	testReachability('a function only an unreachable one calls stays unreachable',
		'inner <- function() write.csv(d, "out.csv")\nouter <- function() inner()\nprint("done")',
		{ unreachable: ['1@write.csv', '2@inner'], reachable: ['3@print'] });
	testReachability('handing a function to `lapply` reaches it',
		'f <- function() write.csv(d, "out.csv")\nlapply(1:2, f)',
		{ reachable: ['1@write.csv'] });
	/* neither of the two is a call flowR resolves, so claiming the body never runs would be wrong */
	testReachability('a function handed to another call may be run by it',
		'register <- function(f) NULL\nregister(function() write.csv(d, "out.csv"))',
		{ reachable: ['2@write.csv'] });
	testReachability('a method of a generic the program calls may be dispatched to',
		'print.foo <- function(x, ...) write.csv(d, "out.csv")\nprint(structure(list(), class = "foo"))',
		{ reachable: ['1@write.csv'] });
	/* an attached package materializes a definition vertex of its own, which is no function of the program */
	testReachability('a call of an attached package is judged like any other',
		'library(svDialogs)\nf <- function() dlgInput("give: ")',
		{ unreachable: ['2@dlgInput'] });
	testReachability('a method of a generic nothing calls is unreachable like any other function',
		'print.foo <- function(x, ...) write.csv(d, "out.csv")\ncat("done")',
		{ unreachable: ['1@write.csv'] });

	test(label('nothing is unreachable without a function definition', ['name-normal'], ['other']), async() => {
		assert.deepStrictEqual((await unreachableIn('x <- 1\nprint(x)')).reported, []);
	});

	test(label('the calls are only reported when asked for', ['name-normal'], ['other']), async() => {
		assert.isUndefined((await unreachableIn('f <- function() print(1)', { type: 'call-graph' })).reported);
	});
}));
