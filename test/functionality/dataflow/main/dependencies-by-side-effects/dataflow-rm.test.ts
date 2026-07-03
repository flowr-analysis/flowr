import { assertDataflow, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in-proc-name';

describe.sequential('Dataflow Plot Dependencies', withShell(shell => {
	assertDataflow(label('Removing breaks link', ['functions-with-global-side-effects']), shell,
		'x <- 2\nrm(x)\nx',
		emptyGraph()
			.defineVariable('1@x', 'x', { definedBy: ['1@<-', '1@2'] })
			.call('2@rm', 'rm', [argumentInCall('4')], { onlyBuiltIn: true, origin: [BuiltInProcName.Rm], reads: [NodeId.toBuiltIn('rm')] })
			.calls('2@rm', NodeId.toBuiltIn('rm'))
			.returns('1@<-', '1@x')
			.use('2@x')
			.constant('1@2')
			.call('1@<-', '<-', [argumentInCall('1'), argumentInCall('0')], { onlyBuiltIn: true, origin: [BuiltInProcName.Assignment], reads: [NodeId.toBuiltIn('<-'), 1] })
			.calls('1@<-', NodeId.toBuiltIn('<-'))
			.reads('2@x', '1@x')
			.use('3@x'),
		{
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('rm with envir=sys.frame(-1) breaks link in caller', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'c <- 2\nbad <- function() rm(list="c", envir=sys.frame(-1))\nbad()\nprint(c)',
		emptyGraph()
			.use('4@c'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@c', '1@c']],
			expectedOutput:        'function (...)  .Primitive("c")'
		}
	);

	assertDataflow(label('rm with envir=sys.frame(0) also breaks link in caller', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'c <- 2\nbad <- function() rm(list="c", envir=sys.frame(0))\nbad()\nprint(c)',
		emptyGraph()
			.use('4@c'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@c', '1@c']]
		}
	);

	assertDataflow(label('rm with envir=sys.frame(-1) does not remove local variable', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'bad <- function() {\n  x <- 3\n  rm(list="x", envir=sys.frame(-1))\n  x\n}\nbad()',
		emptyGraph()
			.use('4@x', 'x', undefined, false)
			.reads('4@x', '2@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			expectedOutput:        '[1] 3'
		}
	);

	assertDataflow(label('rm with envir=sys.frame(-2) does not break link from depth 1', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'c <- 2\nbad <- function() rm(list="c", envir=sys.frame(-2))\nbad()\nprint(c)',
		emptyGraph()
			.use('4@c')
			.reads('4@c', '1@c'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

}));
