import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';

describe('Dataflow Plot Dependencies', { concurrent: false }, withShell(shell => {
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
	/* each case is checked against R: a device holds what is drawn on it from its opening to its close, a plot replaces the one before */
	describe('graphics devices', () => {
		const opts = { expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;
		assertDataflow(label('A close reads the opening and every plot on the device', ['functions-with-global-side-effects']), shell,
			'png("p%d.png")\nplot(1)\nplot(2)\ndev.off()',
			emptyGraph()
				.reads('4@dev.off', '1@png').reads('4@dev.off', '2@plot').reads('4@dev.off', '3@plot')
				.reads('1@png', '4@dev.off'),
			opts
		);
		assertDataflow(label('A plot opening the device is linked to its close', ['functions-with-global-side-effects']), shell,
			'plot(1)\npoints(2)\ndev.off()',
			emptyGraph().reads('2@points', '1@plot').reads('3@dev.off', '1@plot').reads('3@dev.off', '2@points'),
			opts
		);
		assertDataflow(label('An addon reads the plot of its own device', ['functions-with-global-side-effects']), shell,
			'png("a.png")\nplot(1)\npdf("b.pdf")\nplot(2)\ndev.off()\npoints(3)',
			emptyGraph().reads('6@points', '2@plot').reads('5@dev.off', '3@pdf').reads('5@dev.off', '4@plot').reads('3@pdf', '5@dev.off'),
			opts
		);
		assertDataflow(label('A plot in a function', ['functions-with-global-side-effects', 'call-normal']), shell,
			'f <- function() plot(1)\nf()\npoints(2)\ndev.off()',
			emptyGraph().reads('3@points', '1@plot').reads('4@dev.off', '1@plot').reads('4@dev.off', '3@points'),
			opts
		);
		assertDataflow(label('A plot opened in a loop', ['functions-with-global-side-effects', 'for-loop']), shell,
			'for(i in 1:2) {\n\tpng("a.png")\n\tplot(i)\n\tdev.off()\n}',
			emptyGraph().reads('4@dev.off', '2@png').reads('4@dev.off', '3@plot').reads('2@png', '4@dev.off'),
			opts
		);
	});
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
