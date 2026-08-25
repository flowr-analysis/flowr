import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { Queries } from '../../../../src/queries/query';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import type { TREE_SITTER_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';

describe('Multiple queries', withTreeSitter(ts => {
	/**
	 * Requesting several queries at once has to answer each of them exactly as a request for that query alone would,
	 * so we compare every result against the pipeline output it is derived from.
	 */
	function testQueries(name: string, code: string, query: Queries) {
		assertQuery(label(name), ts, code, query, ({ dataflow, normalize }: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE>) => ({
			dataflow:         { graph: dataflow.graph },
			'id-map':         { idMap: normalize.idMap },
			'normalized-ast': { normalized: normalize }
		}), true);
	}

	testQueries('id map and dataflow', 'x <- 2', [
		{ type: 'dataflow' },
		{ type: 'id-map' },
		{ type: 'normalized-ast' }
	]);

	testQueries('the same query repeated next to others', 'f <- function(x) x\nf(3)', [
		{ type: 'id-map' },
		{ type: 'dataflow' },
		{ type: 'id-map' },
		{ type: 'normalized-ast' },
		{ type: 'dataflow' }
	]);
}));
