import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { recoverName } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfEdge } from '../../../../src/dataflow/graph/edge';

/** Every shape whose processing takes a type off an edge, so a leftover typeless edge shows up here. */
const Corpus = [
	'x <- 42\ndelayedAssign("x", { x <- 42; 2 })\nprint(x + x)',
	'k <- 1\ndelayedAssign("v", k + 1)\nk <- 5\nprint(v)',
	'x <- 1\ny <- 2\ne <- quote(x + y)\neval(e)',
	'x <- 1\neval(rlang::expr(x + 1))',
	'library(dplyr)\nk <- 1\nfilter(d, k)\nd |> filter(k)',
	'library(dplyr)\nd |> mutate(newcol := 1)',
	'library(data.table)\ndt <- data.table(a = 1:2)\ndt[, b := a + 1]',
	'names(x) <- "a"\nx$y <- 2\nx[[1]] <- 3',
	'mk <- function(v) function() v\nk <- 5\nfn <- mk(k)\nk <- 6\nfn()',
	'library(glue)\nx <- 5\nglue("{x}")'
];

describe('Dataflow', withTreeSitter(ts => {
	describe('edge invariants', () => {
		test.each(Corpus)('an edge always states a type: %s', async(code) => {
			const graph = (await createDataflowPipeline(ts, { context: contextFromInput(code) }).allRemainingSteps()).dataflow.graph;
			const typeless: string[] = [];
			for(const [from, targets] of graph.edges()) {
				for(const [to, edge] of targets) {
					if(DfEdge.hasNoType(edge)) {
						typeless.push(`${recoverName(from, graph.idMap)}(${from}) -> ${recoverName(to, graph.idMap)}(${to})`);
					}
				}
			}
			assert.deepStrictEqual(typeless, [], 'an edge that states nothing has to be removed, not kept');
		});

		test(label('the reverse index forgets a removed edge as well', ['name-normal'], ['dataflow']), async() => {
			const analysis = await createDataflowPipeline(ts, { context: contextFromInput('x <- 1\nprint(x)') }).allRemainingSteps();
			const graph = analysis.dataflow.graph;
			const [from, targets] = [...graph.edges()][0];
			const [to, edge] = [...targets][0];
			graph.ingoingEdges(to);   /* build the reverse index before the removal */
			graph.removeEdgeType(from, to, edge.types);
			assert.isUndefined(graph.outgoingEdges(from)?.get(to));
			assert.isUndefined(graph.ingoingEdges(to)?.get(from));
		});
	});
}));
