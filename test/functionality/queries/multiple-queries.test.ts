import { assert, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertQuery } from '../_helper/query';
import { label } from '../_helper/label';
import { type Queries, Query } from '../../../src/queries/query';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import type { TREE_SITTER_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';

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

	describe('a single query', () => {
		const code = 'x <- 1\ny <- 2\nx + 1';
		async function analyzer() {
			const a = await new FlowrAnalyzerBuilder().setParser(ts).build();
			a.addRequest(code);
			return a;
		}
		test('answers with the one entry of a per-query result', async() => {
			const a = await analyzer();
			const one = await a.query({ type: 'static-slice', criteria: ['3@x'] });
			const all = await a.query([{ type: 'static-slice', criteria: ['3@x'] }]);
			assert.deepStrictEqual(one.slice.result, Query.first(all, 'static-slice')?.slice.result);
			assert.isDefined(one.reconstruct);
		});
		test('answers with the full result otherwise', async() => {
			const a = await analyzer();
			const one = await a.query({ type: 'id-map' });
			assert.strictEqual(one.idMap, (await a.normalize()).idMap);
		});
		test('throws when the query fails', async() => {
			const a = await analyzer();
			const invalid = { type: 'does-call', queryId: 'q', call: '3@x', calls: { type: 'nope' } } as never;
			await expect(a.query(invalid)).rejects.toThrow('Unhandled constraint type');
		});
	});
}));

