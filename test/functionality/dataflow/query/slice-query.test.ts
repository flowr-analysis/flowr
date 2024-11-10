import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type {
	StaticSliceQuery,
	StaticSliceQueryResult
} from '../../../../src/queries/catalog/static-slice-query/static-slice-query-format';
import { fingerPrintOfQuery } from '../../../../src/queries/catalog/static-slice-query/static-slice-query-executor';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import {
	DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE,
	DEFAULT_SLICING_PIPELINE
} from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { doNotAutoSelect } from '../../../../src/reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../../src/reconstruct/auto-select/magic-comments';
import { describe } from 'vitest';

describe.sequential('Static Slice Query', withShell(shell => {
	function testQuery(name: string, code: string, queries: readonly StaticSliceQuery[]) {
		assertQuery(label(name), shell, code, queries, async() => {
			const results: StaticSliceQueryResult['results'] = {};
			for(const query of queries) {
				const out = await new PipelineExecutor(query.noReconstruction ?  DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE : DEFAULT_SLICING_PIPELINE, {
					shell:        shell,
					request:      requestFromInput(code),
					criterion:    query.criteria,
					autoSelectIf: query.noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect)
				}).allRemainingSteps();
				const key = fingerPrintOfQuery(query);
				results[key] = query.noReconstruction ? { slice: out.slice } : { slice: out.slice, reconstruct: out.reconstruct };
			}

			return {
				'static-slice': {
					results
				}
			};
		});
	}

	const baseQuery: StaticSliceQuery = { type: 'static-slice', criteria: ['1@x'] };
	describe('With Reconstruction', () => {
		testQuery('Single Expression', 'x + 1', [baseQuery]);
		testQuery('Multiple Queries', 'x + 1', [baseQuery, baseQuery, baseQuery]);
	});
	const noReconstructQuery: StaticSliceQuery = { type: 'static-slice', criteria: ['1@x'], noReconstruction: true };
	describe('Without Reconstruction', () => {
		testQuery('Single Expression (No Reconstruct)', 'x + 1', [noReconstructQuery]);
		testQuery('Multiple Queries (No Reconstruct)', 'x + 1', [noReconstructQuery, noReconstructQuery, noReconstructQuery]);
	});
}));
