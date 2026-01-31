import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import {
	type SingleSlicingCriterion,
	slicingCriterionToId
} from '../../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';
import type { ExceptionPoint } from '../../../../src/dataflow/fn/exceptions-of-function';
import { calculateExceptionsOfFunction } from '../../../../src/dataflow/fn/exceptions-of-function';
import type { ControlDependency } from '../../../../src/dataflow/info';

describe('get-exceptions-of-function', withTreeSitter(ts => {
	function testExceptions(
		label: string,
		code: string,
		want: Record<SingleSlicingCriterion, (SingleSlicingCriterion | {id: SingleSlicingCriterion, cds: ControlDependency[] | undefined })[]>
	) {
		test.each(Object.entries(want))(`${label} ($0=>$1)`, async(c, exp) => {
			const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
			analyzer.addRequest(requestFromInput(code));
			const idMap = (await analyzer.normalize()).idMap;
			const id = slicingCriterionToId(c as SingleSlicingCriterion, idMap);
			const expIds: ExceptionPoint[] = exp.map(e => {
				if(typeof (e as unknown) === 'string') {
					return { id: slicingCriterionToId(e as SingleSlicingCriterion, idMap), cds: undefined };
				} else {
					const s = e as {id: SingleSlicingCriterion, cds: ControlDependency[] | undefined };
					return { id: slicingCriterionToId(s.id, idMap), cds: s.cds };
				}
			});
			// move up the error message :sparkles:
			assert.isDefined(id, `could not resolve criterion ${c}`);
			try {
				const e = calculateExceptionsOfFunction(id, await analyzer.callGraph());
				assert.deepStrictEqual(e[id], expIds);
			} catch(e) {
				console.error(`Error while testing criterion ${c} in code:\n${code}`);
				console.log('CG', graphToMermaidUrl(await analyzer.callGraph()));
				console.log('DFG', graphToMermaidUrl((await analyzer.dataflow()).graph));
				throw e;
			}
		});
	}

	testExceptions('Simple Stops', `
f <- function(x) { stop("error") }
g <- function(y) { stopifnot(FALSE) }
h <- function(z) { warning("warn") }
indirect <- function(a) { f(a) }
double_indirect <- function(b) { indirect(b) }
only_sometimes <- function() { if(u) stop("maybe") }
triple_indirect <- function(c) { double_indirect(c) }
	`, {
		'2@function': ['2@stop'], // f
		'3@function': ['3@stopifnot'], // g
		'4@function': [], // h
		'5@function': ['2@stop'], // indirect
		'6@function': ['2@stop'], // double indirect
		'7@function': [{ id: '7@stop', cds: [{ id: 69, when: true }] }], // only sometimes
		'8@function': ['2@stop']  // triple indirect
	});

	testExceptions('Stops with Tries', `
f <- function(x) { try(stop("error")) }
g <- function(y) { tryCatch(stopifnot(FALSE), error=function(e) {}) }
h <- function(z) { f(); }
i <- function() { f(); stop("direct") }
j <- function() { tryCatch({ g() }, finally={stop("also direct")}) }
	`, {
		'2@function': [], // f
		'3@function': [], // g
		'4@function': [], // h
		'5@function': ['5@stop'], // i
		'6@function': ['6@stop'] // j
	});

}));
