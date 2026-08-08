import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';

describe.sequential('Dataflow Plot Dependencies', withShell(shell => {
	assertDataflow(label('Linking points to last plot', ['functions-with-global-side-effects']), shell,
		'plot(f)\npoints(g)',
		emptyGraph()
			.call('2@points', 'points', [], { onlyBuiltIn: true })
			.call('1@plot', 'plot', [], { onlyBuiltIn: true })
			.reads('2@points', '1@plot'), // a non-overloaded points call always reads the last non-overloaded plot call!
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	assertDataflow(label('Effects by pdf', ['functions-with-global-side-effects']), shell,
		'pdf("foo")\nsmoothScatter(f)',
		emptyGraph()
			.call('1@pdf', 'pdf', [], { onlyBuiltIn: true })
			.call('2@smoothScatter', 'smoothScatter', [], { onlyBuiltIn: true })
			.reads('2@smoothScatter', '1@pdf'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	assertDataflow(label('Sink', ['functions-with-global-side-effects']), shell,
		'sink(x)\nprint("foo")\nmessage("bar")',
		emptyGraph()
			.call('1@sink', 'sink', [], { onlyBuiltIn: true })
			.reads('2@print', '1@sink')
			.reads('3@message', '1@sink'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
}));
