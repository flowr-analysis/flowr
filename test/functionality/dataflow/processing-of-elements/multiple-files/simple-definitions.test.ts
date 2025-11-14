import { assertDataflow, retrieveNormalizedAst, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { assert, describe, test } from 'vitest';
import { produceDataFlowGraph } from '../../../../../src/dataflow/extractor';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';

describe.sequential('Simple Defs in Multiple Files', withShell(shell => {

	assertDataflow(label('two files', ['name-normal', 'numbers']), shell,
		[
			{ request: 'text', content: 'x <- 42' },
			{ request: 'text', content: 'y <- 3' },
			{ request: 'text', content: 'print(x + y)' },
		],
		emptyGraph()
			.use('-inline-::root-2-1')
			.reads('-inline-::root-2-1', '0')
			.use('-inline-::root-2-2')
			.reads('-inline-::root-2-2', '-inline-::root-1-0')
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [builtInId('<-')], onlyBuiltIn: true })
			.calls('2', builtInId('<-'))
			.argument('2', ['1', '0'])
			.call('-inline-::root-1-2', '<-', [argumentInCall('-inline-::root-1-0'), argumentInCall('-inline-::root-1-1')], { returns: ['-inline-::root-1-0'], reads: [builtInId('<-')], onlyBuiltIn: true })
			.calls('-inline-::root-1-2', builtInId('<-'))
			.addControlDependency('-inline-::root-1-2', 'root-1', true)
			.argument('-inline-::root-1-2', ['-inline-::root-1-1', '-inline-::root-1-0'])
			.argument('-inline-::root-2-3', '-inline-::root-2-1')
			.argument('-inline-::root-2-3', '-inline-::root-2-2')
			.call('-inline-::root-2-3', '+', [argumentInCall('-inline-::root-2-1'), argumentInCall('-inline-::root-2-2')], { returns: [], reads: ['-inline-::root-2-1', '-inline-::root-2-2', builtInId('+')], onlyBuiltIn: true })
			.calls('-inline-::root-2-3', builtInId('+'))
			.argument('-inline-::root-2-5', '-inline-::root-2-3')
			.reads('-inline-::root-2-5', '-inline-::root-2-3')
			.call('-inline-::root-2-5', 'print', [argumentInCall('-inline-::root-2-3')], { returns: ['-inline-::root-2-3'], reads: [builtInId('print')], onlyBuiltIn: true })
			.calls('-inline-::root-2-5', builtInId('print'))
			.addControlDependency('-inline-::root-2-5', 'root-2', true)
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('-inline-::root-1-1')
			.defineVariable('-inline-::root-1-0', 'y', { definedBy: ['-inline-::root-1-1', '-inline-::root-1-2'] })
			.addControlDependency('-inline-::root-1-0', 'root-1', true)
			.markIdForUnknownSideEffects('-inline-::root-2-5')
	);

	test('Correct File-Info for Multiple Files', async() => {
		const requests = [{
			request: 'file',
			content: 'test/testfiles/parse-multiple/a.R'
		}, {
			request: 'file',
			content: 'test/testfiles/parse-multiple/b.R'
		}] as const;
		const df = produceDataFlowGraph(
			new RShellExecutor(),
			requests,
			await retrieveNormalizedAst(shell, 'file://' + requests[0].content),
			// TODO: check for reqeusts wrapper
			contextFromInput(requests)
		);
		const idMap = df.graph.idMap;
		assert(idMap !== undefined);
		assert(idMap.size > 0);
		for(const [id, node] of idMap.entries()) {
			// assert that the node.info.file is set correctly
			assert(node.info.file !== undefined, `Node ${id} has no file info`);
		}

	});
}));
