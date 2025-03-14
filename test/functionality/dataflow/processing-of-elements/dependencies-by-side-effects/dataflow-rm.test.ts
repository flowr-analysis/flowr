import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';

describe.sequential('Dataflow Plot Dependencies', withShell(shell => {
	assertDataflow(label('Removing breaks link', ['functions-with-global-side-effects']), shell,
		'x <- 2\nrm(x)\nx',
		emptyGraph()
			.defineVariable('1@x', 'x', { definedBy: ['1@<-', '1@2'] })
			.call('2@rm', 'rm', [argumentInCall('4')], { onlyBuiltIn: true })
			.returns('1@<-', '1@x')
			.use('2@x')
			.constant('1@2')
			.call('1@<-', '<-', [argumentInCall('1'), argumentInCall('0')], { onlyBuiltIn: true })
			.reads('2@x', '1@x')
			.use('3@x'), // there is no link between 3@x and 1@x
		{
			resolveIdsAsCriterion: true
		}
	);
}));
