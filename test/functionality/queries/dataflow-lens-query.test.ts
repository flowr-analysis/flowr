import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { Query } from '../../../src/queries/query';
import { DfgVertex } from '../../../src/dataflow/graph/vertex';
import { analyze } from '../_helper/analyzer';

describe('Dataflow Lens Query', withTreeSitter(parser => {
	test('hides operators and keywords without dropping names that merely contain one', async() => {
		const analyzer = await analyze(parser, 'identifier <- 1\nifelse(identifier > 0, 1, 2)\nres <- identifier + 2\nprint(res)');
		const result = await Query.one({ analyzer }, { type: 'dataflow-lens' });
		const graph = result.simplifiedGraph;

		const calls = [...graph.vertices(true)]
			.filter(([, v]) => DfgVertex.isFunctionCall(v))
			.map(([, v]) => (v as { name: string }).name);
		assert.includeMembers(calls, ['ifelse', 'print'], `kept calls: ${calls.join(', ')}`);
		for(const hidden of ['<-', '+', '>']) {
			assert.notInclude(calls, hidden, `${hidden} must be hidden, kept calls: ${calls.join(', ')}`);
		}
	});
}));
