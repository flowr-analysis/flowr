import { describe, test } from 'vitest';
import type { FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import { FlowrSearchGenerator as Q } from '../../../src/search/flowr-search-builder';
import { FlowrFilterCombinator as F } from '../../../src/search/flowr-search-filters';
import { mermaidCodeToUrl } from '../../../src/util/mermaid/mermaid';
import { flowrSearchToMermaid } from '../../../src/search/flowr-search-printer';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { withShell } from '../_helper/shell';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { runSearch } from '../../../src/search/flowr-search-executor';
import { VertexType } from '../../../src/dataflow/graph/vertex';

describe('flowR Search (playground)', withShell(shell => {
	function print(search: FlowrSearchLike) {
		console.log(JSON.stringify(search, null, 2));
		console.log(mermaidCodeToUrl(flowrSearchToMermaid(search)));
	}
	test('poor mans testing', async() => {
		// print(Q.all().filter(RType.Comment));
		/*		const query = Q.get({ line: 3, name: 'x' }).filter(
			F.is(VertexType.Use).or(RType.Number)
		).first().build();*/
		// print(query);

		const search = Q.get({ line: 1, name: '.', nameIsRegex: true }).take(3).filter(
			F.is(VertexType.VariableDefinition).or(VertexType.Use)
		).first().first().build();
		print(search);
		const sample = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			shell,
			request: requestFromInput('x <- x * x + y - x * 7 + z\nprint(x)')
		}).allRemainingSteps();

		const now = performance.now();
		const res = runSearch(search, sample);
		console.log(performance.now() - now + 'ms');
		console.log(res.map(r => r.node.location));
	});
}));
