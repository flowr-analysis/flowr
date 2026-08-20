import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { DfEdge, EdgeType } from '../../../../src/dataflow/graph/edge';
import { VariableDefinitionVertex } from '../../../../src/dataflow/graph/vertex';
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import { NoEdges } from '../../../../src/dataflow/graph/graph';

describe('access on stack environments', withTreeSitter(ts => {
	/** Asserts that the access at `at` reads exactly the variable definitions given by `expected`. */
	function assertReads(name: string, ids: readonly SupportedFlowrCapabilityId[], code: string, at: SlicingCriterion, expected: readonly SlicingCriterion[]): void {
		test(label(name, ids, ['dataflow']), async() => {
			const analysis = await createDataflowPipeline(ts, { context: contextFromInput(code) }).allRemainingSteps();
			const { idMap } = analysis.normalize;
			const graph = analysis.dataflow.graph;
			const got = [...graph.outgoingEdges(SlicingCriterion.parse(at, idMap)) ?? NoEdges]
				.filter(([target, e]) => DfEdge.includesType(e, EdgeType.Reads) && VariableDefinitionVertex.is(graph.getVertex(target)))
				.map(([target]) => String(target)).sort();
			assert.deepStrictEqual(got, expected.map(e => String(SlicingCriterion.parse(e, idMap))).sort(),
				`${code}\n${Dataflow.visualize.mermaid.url(graph)}`);
		});
	}

	assertReads('.GlobalEnv$x', ['dollar-access', 'search-path'],
		'x <- 5\n.GlobalEnv$x', '2@$', ['1@x']);
	assertReads('globalenv()$x', ['dollar-access', 'search-path'],
		'x <- 5\nglobalenv()$x', '2@$', ['1@x']);
	assertReads('.GlobalEnv[["x"]]', ['double-bracket-access', 'search-path'],
		'x <- 5\n.GlobalEnv[["x"]]', '2@[[', ['1@x']);
	assertReads('.env reaches past the data mask', ['dollar-access', 'search-path'],
		'library(dplyr)\nd <- data.frame(x = 1)\nx <- 5\nmutate(d, y = .env$x)', '4@$', ['3@x']);
	assertReads('.env within local', ['dollar-access', 'search-path'],
		'library(dplyr)\nx <- 5\nlocal(mutate(d, y = .env$x))', '3@$', ['2@x']);
	assertReads('.data names a column, not a variable', ['dollar-access'],
		'library(dplyr)\nd <- data.frame(x = 1)\nx <- 5\nmutate(d, y = .data$x)', '4@$', []);
	assertReads('emptyenv has nothing', ['dollar-access', 'search-path'],
		'x <- 5\nemptyenv()$x', '2@$', []);
	assertReads('e <- environment()', ['dollar-access', 'environment-alias'],
		'x <- 5\ne <- environment()\ne$x', '3@$', ['1@x']);
	assertReads('e <- globalenv()', ['dollar-access', 'environment-alias'],
		'x <- 5\ne <- globalenv()\ne$x', '3@$', ['1@x']);
	assertReads('environment(f) is not the current env', ['dollar-access', 'environment-alias'],
		'x <- 5\nf <- function() 1\ne <- environment(f)\ne$x', '4@$', []);
	assertReads('assignment through the stack env keeps the old definition readable', ['dollar-access', 'search-path'],
		'x <- 5\n.GlobalEnv$x <- 1\nprint(x)', '3@x', ['1@x']);
}));
