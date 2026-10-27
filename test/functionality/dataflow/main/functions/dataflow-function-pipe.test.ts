import { assertDataflow, assumeLoadedPackages, skipTestBecauseConfigNotMet, withShell, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { decorateLabelContext, dropTestLabel, label } from '../../../_helper/label';
import { afterAll, describe, test } from 'vitest';
import { RPipe } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { deterministicCountingIdGenerator } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RShell } from '../../../../../src/r-bridge/shell';
import type { KnownParser } from '../../../../../src/r-bridge/parser';

assumeLoadedPackages('magrittr');

/* both parsers, as R reads the placeholder `_` as a token of its own that tree-sitter does not have */
function pipes(ts: KnownParser): void {
	const pipeConfig = { minRVersion: RPipe.hasPlaceHolderFromRVersion().toString(), expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
	describe('Basic Joining', () => {
		assertDataflow(label('Basic Pipe', ['pipe-and-pipe-bind']), ts, 'x |> f()',
			emptyGraph()
				.addEdge('1@f', '1@x', EdgeType.Argument | EdgeType.Reads)
				.call('1@f', 'f', [argumentInCall('1@x')]),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe With Placeholder and Argument Name', ['pipe-and-pipe-bind']), ts, 'x |> f(a=_)',
			emptyGraph()
				.reads('1@_', '1@x')
				.reads('1@f', '$4')
				.call('1@f', 'f', [argumentInCall(4)], { omitArgs: true }),
			pipeConfig
		);
		/* R only takes the placeholder as a named argument, or at the head of an extraction (`_$a`) */
		assertDataflow(label('Basic Pipe As Second Arg', ['pipe-and-pipe-bind']), ts, 'x |> f(y, a = _)',
			emptyGraph()
				.reads('1@_', '1@x')
				.addEdge('1@f', '1@y', EdgeType.Argument | EdgeType.Reads)
				.call('1@f', 'f', [argumentInCall('1@y')], { omitArgs: true }),
			pipeConfig
		);
		assertDataflow(label('Basic Pipe As Head of an Extraction', ['pipe-and-pipe-bind']), ts, 'x |> _$a',
			emptyGraph()
				.reads('1@_', '1@x'),
			{ ...pipeConfig, minRVersion: RPipe.hasAccessPlaceHolderFromRVersion().toString() }
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
}

describe('Function Call Pipes', () => {
	describe('tree-sitter', withTreeSitter(ts => {
		pipes(ts);
		test(decorateLabelContext(label('Pipe-bind has no tree-sitter grammar production', ['pipe-bind']), ['dataflow']), async({ expect }) => {
			const analyzer = await new FlowrAnalyzerBuilder()
				.setInput({ getId: deterministicCountingIdGenerator(0) })
				.setParser(ts)
				.build();
			analyzer.addRequest('x |> y => f(y)');
			await expect(analyzer.normalize()).rejects.toThrow(/pipe-bind/);
		});
	}));
	describe('R shell', { concurrent: false }, withShell(pipes));
});

describe('Function Call Pipe-Bind (disabled by default)', withShell(shell => {
	const pipeBindDisabled = label('Pipe-bind is disabled unless engine.r-shell.pipeBind is enabled', ['pipe-bind']);
	const skip = skipTestBecauseConfigNotMet({ minRVersion: RPipe.hasPipeBindFromRVersion().toString() });
	if(skip) {
		dropTestLabel(pipeBindDisabled);
	}
	test.skipIf(skip)(decorateLabelContext(pipeBindDisabled, ['dataflow']), async({ expect }) => {
		const analyzer = await new FlowrAnalyzerBuilder()
			.setInput({ getId: deterministicCountingIdGenerator(0) })
			.setParser(shell)
			.build();
		analyzer.addRequest('x |> y => f(y)');
		await expect(analyzer.normalize()).rejects.toThrow(/pipe-bind/);
	});
}));

describe('Function Call Pipe-Bind (real R engine only)', () => {
	const pipeBindShell = new RShell({ type: 'r-shell', pipeBind: true });
	afterAll(() => pipeBindShell.close());
	const pipeBindConfig = { minRVersion: RPipe.hasPipeBindFromRVersion().toString(), expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
	assertDataflow(label('Pipe-bind reads the piped value and its body reads the bound name', ['pipe-and-pipe-bind', 'pipe-bind']),
		pipeBindShell, 'x |> y =>\n  f(y)',
		emptyGraph()
			.use('2@y', 'y', { cds: [{ id: 9, when: true, byPromise: true }, { id: 7, when: true, byPromise: true }] })
			.reads('2@y', '1@y')
			.reads('2@f', '2@y')
			.call('2@f', 'f', [argumentInCall('2@y')], { cds: [{ id: 9, when: true, byPromise: true }] }),
		pipeBindConfig
	);
	assertDataflow(label('Chained pipe into a pipe-bind', ['pipe-and-pipe-bind', 'pipe-bind']),
		pipeBindShell, 'x |> g() |> y =>\n  f(y)',
		emptyGraph()
			.use('2@y', 'y', { cds: [{ id: 13, when: true, byPromise: true }, { id: 11, when: true, byPromise: true }] })
			.reads('2@y', '1@y')
			.reads('2@f', '2@y')
			.call('2@f', 'f', [argumentInCall('2@y')], { cds: [{ id: 13, when: true, byPromise: true }] }),
		pipeBindConfig
	);
});
