import { describe } from 'vitest';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { label } from '../../_helper/label';
import { withTreeSitter, assertDataflow } from '../../_helper/shell';

describe.sequential('eval', withTreeSitter(tr => {
	assertDataflow(label('simple eval use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'a <- "1+1"\nx <- "1"\nb <- "3"\nz <- eval(parse(text=x))', emptyGraph()
			.defineVariable('2@x')
			.defineVariable('4@z')
			.definedBy('4@z', '4@eval')
			.addEdge('4@eval', '4@parse', EdgeType.Argument | EdgeType.Reads | EdgeType.Returns)
			.addEdge('4@parse', '4@x', EdgeType.Reads)
			.addEdge('4@x', '2@x', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
	assertDataflow(label('simple eval use - from 2 variables', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'x <- 1\ny <- 1\na <- 2\nz <- eval(parse(text="x+y"))', emptyGraph()
			.definedBy('4@z', '4@eval')
			.addEdge(17, 'eval::17-4:6-4:9-2', EdgeType.Returns)
			.addEdge('eval::17-4:6-4:9-2', 'eval::17-4:6-4:9-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17-4:6-4:9-2', 'eval::17-4:6-4:9-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17-4:6-4:9-0', '1@x', EdgeType.Reads)
			.addEdge('eval::17-4:6-4:9-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));

describe.sequential('evalText', withTreeSitter(tr => {
	assertDataflow(label('simple evalText use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'a <- "1+1"\nx <- "1"\nb <- "3"\nz <- evalText(x)', emptyGraph()
			.defineVariable('2@x')
			.defineVariable('4@z')
			.definedBy('4@z', '4@evalText')
			.addEdge('4@evalText', '4@x', EdgeType.Argument | EdgeType.Reads | EdgeType.Returns)
			.addEdge('4@x', '2@x', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
	assertDataflow(label('simple evalText use  - from 2 variables', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'x <- 1\ny <- 1\na <- 2\nz <- evalText("x+y")', emptyGraph()
			.definedBy('4@z', '4@evalText')
			.addEdge(13, 'evalText::13-4:6-4:13-2', EdgeType.Returns)
			.addEdge('evalText::13-4:6-4:13-2', 'evalText::13-4:6-4:13-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13-4:6-4:13-2', 'evalText::13-4:6-4:13-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13-4:6-4:13-0', '1@x', EdgeType.Reads)
			.addEdge('evalText::13-4:6-4:13-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));