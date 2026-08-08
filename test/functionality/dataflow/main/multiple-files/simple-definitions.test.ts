import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('Simple Defs in Multiple Files', withShell(shell => {

	assertDataflow(label('two files', ['name-normal', 'numbers']), shell,
		[
			{ request: 'text', content: 'x <- 42' },
			{ request: 'text', content: 'y <- 3' },
			{ request: 'text', content: 'print(x + y)' },
		],
		emptyGraph()
			.use(9)
			.reads(9, '0')
			.use(10)
			.reads(10, 4)
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [NodeId.toBuiltIn('<-'), 1], onlyBuiltIn: true })
			.calls('2', NodeId.toBuiltIn('<-'))
			.argument('2', ['1', '0'])
			.call(6, '<-', [argumentInCall(4), argumentInCall(5)], { returns: [4], reads: [NodeId.toBuiltIn('<-'), 5], onlyBuiltIn: true })
			.calls(6, NodeId.toBuiltIn('<-'))
			.argument(6, [5, 4])
			.argument(11, 9)
			.argument(11, 10)
			.call(11, '+', [argumentInCall(9), argumentInCall(10)], { returns: [], reads: [9, 10, NodeId.toBuiltIn('+')], onlyBuiltIn: true })
			.calls(11, NodeId.toBuiltIn('+'))
			.argument(13, 11)
			.reads(13, 11)
			.call(13, 'print', [argumentInCall(11)], { returns: [11], reads: [NodeId.toBuiltIn('print')], onlyBuiltIn: true })
			.calls(13, NodeId.toBuiltIn('print'))
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant(5)
			.defineVariable(4, 'y', { definedBy: [5, 6] })
			.markIdForUnknownSideEffects(13)
	);

	test('Correct File-Info for Multiple Files', async() => {
		const requests = [{
			request: 'file',
			content: 'test/testfiles/parse-multiple/a.R'
		}, {
			request: 'file',
			content: 'test/testfiles/parse-multiple/b.R'
		}] as const;
		const analyzer = await new FlowrAnalyzerBuilder()
			.setEngine('tree-sitter')
			.build();
		analyzer.addRequest(requests);
		const idMap = (await analyzer.normalize()).idMap;
		assert(idMap !== undefined);
		assert(idMap.size > 0);
		for(const [id, node] of idMap.entries()) {
			// assert that the node.info.file is set correctly
			assert(node.info.file !== undefined, `Node ${id} has no file info`);
		}

	});
}));
