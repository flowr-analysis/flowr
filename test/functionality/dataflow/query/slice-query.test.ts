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
import { doNotAutoSelect } from '../../../../src/reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../../src/reconstruct/auto-select/magic-comments';
import { describe, it } from 'vitest';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile, FlowrTextFile } from '../../../../src/project/context/flowr-file';



describe.sequential('Static Slice Query', withShell(shell => {
	function testQuery(name: string, code: string, queries: readonly StaticSliceQuery[]) {
		assertQuery(label(name), shell, code, queries, async() => {
			const results: StaticSliceQueryResult['results'] = {};
			for(const query of queries) {
				const out = await new PipelineExecutor(query.noReconstruction ?  DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE : DEFAULT_SLICING_PIPELINE, {
					parser:       shell,
					context:      contextFromInput(code),
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

	describe.only('foo', () => {
		it('hihi', async() => {
			const analyzer = await new FlowrAnalyzerBuilder()
				.setEngine('tree-sitter')
				.build();
			const f = new FlowrInlineTextFile('a/b/c.r', 'foo');
			analyzer
				.addFile(
					f,
					new FlowrInlineTextFile('a/b/DESCRIPTION', 'lol'),
					new FlowrTextFile('test/foo')
				)
				.addRequest(
					'file://test',
					{ request: 'project', content: '' }
				);

			await analyzer.dataflow();
		});
	});

}));
