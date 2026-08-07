import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { executeQueries } from '../../../../src/queries/query';
import { VertexType } from '../../../../src/dataflow/graph/vertex';

describe('Dataflow Lens Query', withTreeSitter(parser => {
	test('hides operators and keywords without dropping names that merely contain one', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('identifier <- 1\nifelse(identifier > 0, 1, 2)\nres <- identifier + 2\nprint(res)');
		const result = await executeQueries({ analyzer }, [{ type: 'dataflow-lens' }]);
		const graph = result['dataflow-lens'].simplifiedGraph;

		const calls = [...graph.vertices(true)]
			.filter(([, v]) => v.tag === VertexType.FunctionCall)
			.map(([, v]) => (v as { name: string }).name);
		assert.includeMembers(calls, ['ifelse', 'print'], `kept calls: ${calls.join(', ')}`);
		for(const hidden of ['<-', '+', '>']) {
			assert.notInclude(calls, hidden, `${hidden} must be hidden, kept calls: ${calls.join(', ')}`);
		}
	});
}));
