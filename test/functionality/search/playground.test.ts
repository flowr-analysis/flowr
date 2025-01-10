import { describe, test } from 'vitest';
import type { FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { FlowrFilterCombinator as F } from '../../../src/search/flowr-search-filters';
import { mermaidCodeToUrl } from '../../../src/util/mermaid/mermaid';
import { flowrSearchToMermaid } from '../../../src/search/flowr-search-printer';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { withShell } from '../_helper/shell';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { runSearch } from '../../../src/search/flowr-search-executor';

describe('flowR Search (playground)', withShell(shell => {
	function print(search: FlowrSearchLike) {
		console.log(JSON.stringify(search, null, 2));
		console.log(mermaidCodeToUrl(flowrSearchToMermaid(search)));
	}
	test('poor mans testing', async() => {
		// print(Q.all().filter(RType.Comment));
		const query = Q.get({ line: 3, name: 'x' }).filter(
			F.is(VertexType.Use).or(RType.Number)
		).first().build();
		// print(query);

		const first = Q.criterion('1@x', '2@x').build();
		// .filter(F.is(VertexType.Use)).build();
		print(first);
		const sample = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			shell,
			request: requestFromInput('x <- 2\nprint(x)')
		}).allRemainingSteps();

		const res = runSearch(first, sample);
		console.log(res);
	});
}));
