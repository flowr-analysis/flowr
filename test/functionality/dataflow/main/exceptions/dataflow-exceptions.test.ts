import { assert, describe, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import type { SingleSlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { Q } from '../../../../../src/search/flowr-search-builder';
import { graphToMermaidUrl } from '../../../../../src/util/mermaid/dfg';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';

interface DFConstraints {
	hasVertices:         SingleSlicingCriterion[];
	doesNotHaveVertices: SingleSlicingCriterion[];
}

describe('Dataflow, Handle Exceptions', withTreeSitter(ts  => {
	function checkDfContains(code: string, constraints: DFConstraints): void {
		const effName = label(code, ['exceptions-and-errors'], ['dataflow']);
		test(effName, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const df = await analyzer.dataflow();
			try {
				for(const [coll, shouldHave] of [[constraints.hasVertices, true], [constraints.doesNotHaveVertices, false]] as const) {
					for(const v of coll) {
						const resolved = (await analyzer.runSearch(Q.criterion(v))).getElements();
						assert.lengthOf(resolved, 1);
						const id = resolved[0].node.info.id;
						const hasVertex = df.graph.hasVertex(id);
						assert.strictEqual(hasVertex, shouldHave);
					}
				}
			} catch(e: unknown) {
				console.error('DF', graphToMermaidUrl(df.graph));
				throw e;
			}
		});
	}

	describe('Simple Exceptions', () => {
		const trueVariants = ['stopifnot(TRUE)', 'if(FALSE) stop()', 'stopifnot(u)', 'stopifnot(TRUE, u)', 'stopifnot(TRUE, TRUE)', 'stopifnot(TRUE, T, TRUE)', 'stopifnot(t, t)', 'stopifnot(exprs={TRUE; TRUE})'];
		const falseVariants = ['if(TRUE) stop()', 'repeat { stop() }', 'stop()', 'stop(msg)', 'stopifnot(FALSE)', 'stopifnot(FALSE, u)', 'stopifnot(FALSE, TRUE)', 'stopifnot(FALSE, F, FALSE)', 'stopifnot(f, f)', 'stopifnot(exprs={FALSE; FALSE})'];
		for(const [variant, exp] of [[trueVariants, true], [falseVariants, false]] as const) {
			describe(exp ? 'Reachable' : 'Unreachable', () => {
				for(const v of variant) {
					checkDfContains(`x <- 1
t <- TRUE
f <- FALSE
${v}
3`, { hasVertices: exp ? ['1@1', '5@3'] : ['1@1'], doesNotHaveVertices: exp ? [] : ['5@3'] });
				}
			});
		}
	});
	describe('Exceptions must propagate through functions', () => {
		for(const [stopName, callArgs] of [['stop', ''], ['stopifnot', 'FALSE'], ['abort', '']] as const) {
			checkDfContains(`1
indirect <- function() { ${stopName}(${callArgs}) }
indirect()
3`, { hasVertices: ['1@1'], doesNotHaveVertices: ['4@3'] });
		}
	});
	describe('Exceptions with try and tryCatch', () => {
		describe('try', () => {
			checkDfContains('1\ntry({ stop("error") })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry({ stop("error") }, silent=TRUE)\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry(if(u) stop(), silent=TRUE)\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntry(x, silent=stop("x"))\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\ntry(x);stop()\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nstop();try(x)\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nprint({ stop("error") })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
		});
		describe('tryCatch', () => {
			checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) {  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) { stop("another") })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\ntryCatch({ if(u) stop("error") }, error=function(e) {  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntryCatch({ x }, error=function(e) { stop("x") })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			checkDfContains('1\ntryCatch({ stop(x) }, error=function(e) { stop("x") })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nstop();tryCatch({ x }, error=function(e) {  })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) {  });stop()\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
			checkDfContains('1\nprint(tryCatch({ stop("error") }, error=function(e) {  }))\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			describe('With finally', () => {
				checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) {  }, finally={  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
				checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) { stop("another") }, finally={  })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\ntryCatch({ if(u) stop("error") }, error=function(e) {  }, finally={  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
				checkDfContains('1\ntryCatch({ if(u) stop("error") }, error=function(e) { stop("error") }, finally={  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
				checkDfContains('1\ntryCatch({ if(u) stop("error") else stop("error") }, error=function(e) { stop("error") }, finally={  })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\ntryCatch({ x }, error=function(e) { stop("x") }, finally={  })\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
				checkDfContains('1\nstop();tryCatch({ x }, error=function(e) {  }, finally={  })\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) {  }, finally={ });stop()\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\ntryCatch({ stop("error") }, error=function(e) {  }, finally={ stop() });\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\ntryCatch({ u }, error=function(e) {  }, finally={ stop() });\n3', { hasVertices: ['1@1'], doesNotHaveVertices: ['3@3'] });
				checkDfContains('1\nprint(tryCatch({ stop("error") }, error=function(e) {  }, finally={ }))\n3', { hasVertices: ['1@1', '3@3'], doesNotHaveVertices: [] });
			});
			describe('Verify call edges for error handler', () => {
				assertDataflow(label('Call edges for error', ['exceptions-and-errors', 'call-anonymous']), ts,
					'tryCatch(x, error=function(e) {})',
					emptyGraph()
						.addEdge('1@tryCatch', '$10', EdgeType.Reads | EdgeType.Calls | EdgeType.Argument)
						.addEdge('$10', '1@function', EdgeType.Reads | EdgeType.Calls)
					,
					{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
				);
				assertDataflow(label('Call edges for error with fn', ['exceptions-and-errors', 'call-normal']), ts,
					'f <- function() 2\ntryCatch(x, error=f)',
					emptyGraph()
						.addEdge('2@tryCatch', '$10', EdgeType.Reads | EdgeType.Calls | EdgeType.Argument)
						.addEdge('$10', '2@f', EdgeType.Reads | EdgeType.Calls)
						.addEdge('2@f', '1@function', EdgeType.Calls)
					,
					{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
				);
				assertDataflow(label('Call edges with may built-in', ['exceptions-and-errors', 'call-normal', 'built-in']), ts,
					'if(u) sum <- function() 3\ntryCatch(x, error=sum)',
					emptyGraph()
						.addEdge('2@tryCatch', '$13', EdgeType.Reads | EdgeType.Calls | EdgeType.Argument)
						.addEdge('$13', '2@sum', EdgeType.Reads | EdgeType.Calls)
						.calls('2@sum', '1@function')
						.addEdge('2@sum', builtInId('sum'), EdgeType.Calls | EdgeType.Reads)
					,
					{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
				);
			});
		});
	});
}));