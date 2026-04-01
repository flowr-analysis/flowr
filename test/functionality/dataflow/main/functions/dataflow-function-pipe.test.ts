import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { RPipe } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';

describe('Function Call Pipes', withTreeSitter(ts => {
	const pipeConfig = { minRVersion: RPipe.hasPlaceHolderFromRVersion().toString(), expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
	describe('Basic Joining', () => {
		assertDataflow(label('Basic Pipe', ['pipe-and-pipe-bind']), ts, 'x |> f()',
			emptyGraph()
				.addEdge('1@f', '1@x', EdgeType.Argument | EdgeType.Reads)
				.call('1@f', 'f', [argumentInCall('1@x')]),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe With Placeholder', ['pipe-and-pipe-bind']), ts, 'x |> f(_)',
			emptyGraph()
				.reads('1@_', '1@x')
				.reads('1@f', '1@_')
				.call('1@f', 'f', [argumentInCall('1@_')]),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe With Placeholder and Argument Name', ['pipe-and-pipe-bind']), ts, 'x |> f(a=_)',
			emptyGraph()
				.reads('1@_', '1@x')
				.reads('1@f', '$4')
				.call('1@f', 'f', [argumentInCall(4)], { omitArgs: true }),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe As Second Arg', ['pipe-and-pipe-bind']), ts, 'x |> f(y, _)',
			emptyGraph()
				.reads('1@_', '1@x')
				.reads('1@f', '1@y')
				.reads('1@f', '1@_')
				.call('1@f', 'f', [argumentInCall('1@y'), argumentInCall('1@_')]),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe As Access in Arg', ['pipe-and-pipe-bind']), ts, 'x |> f(y, k=_$a)',
			emptyGraph()
				.reads('1@_', '1@x')
				.reads('1@f', '1@y')
				.call('1@f', 'f', [argumentInCall('1@y'), argumentInCall(10)]),
			pipeConfig
		);
		describe('magrittr', () => {
			assertDataflow(label('With %>%', ['pipe-and-pipe-bind']), ts, 'x %>% f(y, .)',
				emptyGraph()
					.reads('1@.', '1@x')
					.reads('1@f', '1@y')
					.reads('1@f', '1@.')
					.call('1@f', 'f', [argumentInCall('1@y'), argumentInCall('1@.')]),
				{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
			);
			assertDataflow(label('With %>%', ['pipe-and-pipe-bind']), ts, 'x %>% f',
				emptyGraph()
					.reads('1@f', '1@x')
					.call('1@f', 'f', [argumentInCall('1@x')]),
				{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
			);
		});
	});
	describe('Assignment Joins', () => {
		assertDataflow(label('With %<>%', ['pipe-and-pipe-bind']), ts, 'x %<>% f(y, .)',
			emptyGraph()
				.reads('1@.', '1@x')
				.reads('1@f', '1@y')
				.reads('1@f', '1@.')
				.defineVariable('1@x')
				.call('1@f', 'f', [argumentInCall('1@y'), argumentInCall('1@.')]),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
		assertDataflow(label('With %<>% and pre-use', ['pipe-and-pipe-bind']), ts, 'x <- 42\nx %<>% f(y, .)',
			emptyGraph()
				.reads('2@.', '2@x')
				.reads('2@f', '2@y')
				.reads('2@f', '2@.')
				.defineVariable('2@x')
				.reads('2@x', '1@x')
				.call('2@f', 'f', [argumentInCall('2@y'), argumentInCall('2@.')]),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
	});
	describe('T Joins', () => {
		assertDataflow(label('With T return', ['pipe-and-pipe-bind']), ts, 'x %T>% f(y)',
			emptyGraph()
				.addEdge(8, '1@x', EdgeType.Returns | EdgeType.Argument),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
		assertDataflow(label('No T return', ['pipe-and-pipe-bind']), ts, 'x %>% f(y)',
			emptyGraph()
				.addEdge(8, '1@f', EdgeType.Returns | EdgeType.Argument),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
		);
	});
}));
