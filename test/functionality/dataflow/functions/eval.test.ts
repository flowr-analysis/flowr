import { assert, describe, test } from 'vitest';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { label } from '../../_helper/label';
import { assertDataflow, assumeLoadedPackages, withTreeSitter } from '../../_helper/shell';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { OriginType } from '../../../../src/dataflow/origin/dfg-get-origin';
import type { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

assumeLoadedPackages('SoDA');

describe('eval', { concurrent: false }, withTreeSitter(tr => {
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
			.addEdge(17, 'eval::17:4:6-2', EdgeType.Returns)
			.addEdge('eval::17:4:6-2', 'eval::17:4:6-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17:4:6-2', 'eval::17:4:6-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17:4:6-0', '1@x', EdgeType.Reads)
			.addEdge('eval::17:4:6-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));

describe('eval argument matching', { concurrent: false }, withTreeSitter((tr: TreeSitterExecutor) => {
	async function analyze(code: string) {
		const res = await createDataflowPipeline(tr, { context: contextFromInput(code) }).allRemainingSteps();
		const graph = res.dataflow.graph;
		const idOf = (criterion: SlicingCriterion) => SlicingCriterion.parse(criterion, res.normalize.idMap);
		return {
			/** the definitions the given criterion reads from */
			reads:         (criterion: SlicingCriterion) => Dataflow.origin(graph, idOf(criterion))?.filter(o => o.type === OriginType.ReadVariableOrigin) ?? [],
			hasSideEffect: (criterion: SlicingCriterion) => [...graph.unknownSideEffects].some(u => (typeof u === 'object' ? u.id : u) === idOf(criterion))
		};
	}

	test(label('eval with envir analyzes the code and marks the call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'strings', 'numbers', 'named-arguments', 'unnamed-arguments', 'built-in-evaluation', 'newlines'], ['dataflow']), async() => {
		const { reads, hasSideEffect } = await analyze('e <- new.env()\ncode <- "a <- 1"\neval(parse(text = code), envir = e)\na');
		assert.isNotEmpty(reads('4@a'), 'the evaluated code must be analyzed');
		assert.isTrue(hasSideEffect('3@eval'), 'the definitions land in another environment, so the call is unknown');
	});

	test(label('eval without envir stays unmarked', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'strings', 'numbers', 'named-arguments', 'unnamed-arguments', 'built-in-evaluation', 'newlines'], ['dataflow']), async() => {
		const { reads, hasSideEffect } = await analyze('code <- "a <- 1"\neval(parse(text = code))\na');
		assert.isNotEmpty(reads('3@a'), 'the evaluated code must be analyzed');
		assert.isFalse(hasSideEffect('2@eval'), 'without envir the definitions land in the current environment');
	});

	test(label('eval resolves expr given by name in any order', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'strings', 'numbers', 'named-arguments', 'built-in-evaluation', 'newlines'], ['dataflow']), async() => {
		const { reads } = await analyze('eval(envir = e, expr = parse(text = "a <- 1"))\na');
		assert.isNotEmpty(reads('2@a'), 'expr must be matched by name');
	});

	test(label('eval with an unresolvable expr is an unknown side effect', ['name-normal', 'unnamed-arguments', 'built-in-evaluation'], ['dataflow']), async() => {
		const { hasSideEffect } = await analyze('eval(foo(bar), baz, qux)');
		assert.isTrue(hasSideEffect('1@eval'), 'nothing is known about the evaluated code');
	});
}));

describe('evalText', { concurrent: false }, withTreeSitter(tr => {
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
			.addEdge(13, 'evalText::13:4:6-2', EdgeType.Returns)
			.addEdge('evalText::13:4:6-2', 'evalText::13:4:6-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13:4:6-2', 'evalText::13:4:6-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13:4:6-0', '1@x', EdgeType.Reads)
			.addEdge('evalText::13:4:6-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));