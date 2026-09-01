import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import {
	SlicingCriterion,
} from '../../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { ExceptionPoint } from '../../../../src/dataflow/fn/exceptions-of-function';
import type { ControlDependency } from '../../../../src/dataflow/info';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { CallGraph } from '../../../../src/dataflow/graph/call-graph';
import { FunctionSemantics } from '../../../../src/dataflow/fn/function-semantics';


describe('get-exceptions-of-function', withTreeSitter(ts => {
	function testExceptions(
		label: string,
		code: string,
		want: Record<SlicingCriterion, (SlicingCriterion | { id: SlicingCriterion, cds: ControlDependency[] | undefined })[]>
	) {
		test.each(Object.entries(want))(`${label} ($0=>$1)`, async(c, exp) => {
			const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
			analyzer.addRequest(requestFromInput(code));
			const idMap = (await analyzer.normalize()).idMap;
			const id = SlicingCriterion.parse(c as SlicingCriterion, idMap);
			const expIds: ExceptionPoint[] = exp.map(e => {
				if(typeof (e as unknown) === 'string') {
					return { id: SlicingCriterion.parse(e as SlicingCriterion, idMap), cds: undefined };
				} else {
					const s = e as { id: SlicingCriterion, cds: ControlDependency[] | undefined };
					return { id: SlicingCriterion.parse(s.id, idMap), cds: s.cds };
				}
			});
			// move up the error message :sparkles:
			assert.isDefined(id, `could not resolve criterion ${c}`);
			try {
				const e = FunctionSemantics.exceptions(id, await analyzer.callGraph());
				assert.deepStrictEqual(e[id], expIds);
			} catch(e) {
				console.error(`Error while testing criterion ${c} in code:\n${code}`);
				console.log('CG', CallGraph.visualize.mermaid.url(await analyzer.callGraph()));
				console.log('DFG', Dataflow.visualize.mermaid.url((await analyzer.dataflow()).graph));
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

	test('every definition the walk passes counts what it calls', async() => {
		const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
		analyzer.addRequest(requestFromInput('h <- function() stop("boom")\ng <- function() h()\nf <- function() g()'));
		const idMap = (await analyzer.normalize()).idMap;
		const at = (c: SlicingCriterion) => SlicingCriterion.parse(c, idMap);
		const found = FunctionSemantics.exceptions(at('3@function'), await analyzer.callGraph());
		const raised = [{ id: at('1@stop'), cds: undefined }];
		/* asking about `f` also answers for the `g` between it and the `stop`, which is what makes the
		   answer fit to hand back as `knownThrower` */
		assert.deepStrictEqual(found[at('3@function')], raised, 'f');
		assert.deepStrictEqual(found[at('2@function')], raised, 'g');
		assert.deepStrictEqual(found[at('1@function')], raised, 'h');
	});

	test('a point reached along two paths is one point', async() => {
		const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
		analyzer.addRequest(requestFromInput('h <- function() stop("boom")\nf <- function() { h(); h() }'));
		const idMap = (await analyzer.normalize()).idMap;
		const found = FunctionSemantics.exceptions(SlicingCriterion.parse('2@function', idMap), await analyzer.callGraph());
		assert.deepStrictEqual(found[SlicingCriterion.parse('2@function', idMap)], [{ id: SlicingCriterion.parse('1@stop', idMap), cds: undefined }]);
	});

	test('functions calling each other settle on what they raise', async() => {
		const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
		analyzer.addRequest(requestFromInput('a <- function() { b(); stop("x") }\nb <- function() a()'));
		const idMap = (await analyzer.normalize()).idMap;
		const raised = [{ id: SlicingCriterion.parse('1@stop', idMap), cds: undefined }];
		const found = FunctionSemantics.exceptions(SlicingCriterion.parse('1@function', idMap), await analyzer.callGraph());
		assert.deepStrictEqual(found[SlicingCriterion.parse('1@function', idMap)], raised, 'a');
		assert.deepStrictEqual(found[SlicingCriterion.parse('2@function', idMap)], raised, 'b');
	});

}));
