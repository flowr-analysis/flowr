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

	assertDataflow(label('rm(list=ls()) clears the whole environment', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\ny <- 2\nrm(list=ls())\nx',
		emptyGraph()
			.use('4@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@x', '1@x'], ['4@x', '2@y']]
		}
	);

	assertDataflow(label('a shadowed ls does not clear the environment', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'ls <- function() "z"\nx <- 1\nrm(list=ls())\nx',
		emptyGraph()
			.use('4@x')
			.reads('4@x', '2@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('a conditional rm only maybe removes the variable', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nif(u) rm(x)\nx',
		emptyGraph()
			.use('3@x')
			.reads('3@x', '1@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('an rm within a loop only maybe removes the variable', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nfor(i in 1:3) rm(x)\nx',
		emptyGraph()
			.use('3@x')
			.reads('3@x', '1@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('an rm with an unresolvable list only maybe removes', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nrm(list=zzz)\nx',
		emptyGraph()
			.use('3@x')
			.reads('3@x', '1@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('an rm nested in a block removes the outer variable', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\n{ rm(x) }\nx',
		emptyGraph()
			.use('3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['3@x', '1@x']]
		}
	);

	assertDataflow(label('rm in both branches removes the variable (verified: R rm removes it)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nif(u) rm(x) else rm(x)\nx',
		emptyGraph()
			.use('3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['3@x', '1@x']]
		}
	);

	assertDataflow(label('rm removes every named argument (verified: R removes both)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\ny <- 2\nrm(x, y)\nx\ny',
		emptyGraph()
			.use('4@x')
			.use('5@y'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@x', '1@x'], ['5@y', '2@y']]
		}
	);

	assertDataflow(label('rm accepts a mix of symbols and strings (verified: R removes x)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nrm(x, "y")\nx',
		emptyGraph()
			.use('3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['3@x', '1@x']]
		}
	);

	assertDataflow(label('a redefinition after rm shadows the removed one (verified: R prints 2)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nrm(x)\nx <- 2\nx',
		emptyGraph()
			.use('4@x')
			.reads('4@x', '3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@x', '1@x']]
		}
	);

	assertDataflow(label('a local rm does not remove the outer variable (verified: R keeps it)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nf <- function() rm(x)\nf()\nx',
		emptyGraph()
			.use('4@x')
			.reads('4@x', '1@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('a deeply nested conditional rm only maybe removes', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nif(a) { if(b) rm(x) }\nx',
		emptyGraph()
			.use('3@x')
			.reads('3@x', '1@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('a redefinition after rm within a block survives (verified: R prints 5)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'{ x <- 1\nrm(x)\nx <- 5 }\nx',
		emptyGraph()
			.use('4@x')
			.reads('4@x', '3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['4@x', '1@x']]
		}
	);

	assertDataflow(label('a definition after rm(list=ls()) within a block survives (verified: R prints 5)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'{ rm(list=ls())\ny <- 5 }\ny',
		emptyGraph()
			.use('3@y')
			.reads('3@y', '2@y'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true
		}
	);

	assertDataflow(label('rm(list=base::ls()) clears the whole environment (verified: R removes it)', ['functions-with-global-side-effects', 'dynamic-variable-removal']), shell,
		'x <- 1\nrm(list=base::ls())\nx',
		emptyGraph()
			.use('3@x'),
		{
			resolveIdsAsCriterion: true,
			expectIsSubgraph:      true,
			mustNotHaveEdges:      [['3@x', '1@x']]
		}
	);

}));
