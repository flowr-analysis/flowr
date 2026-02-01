import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('Resolve for Namespaces', withTreeSitter(ts => {
	assertDataflow(label('Simple Assign Break', ['namespaces', 'lexicographic-scope']), ts,
		'x <- 42\nprint(base::x)',
		emptyGraph(),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			mustNotHaveEdges:      [['2@x', '1@x']]
		} as const
	);
	assertDataflow(label('Double Base', ['namespaces', 'lexicographic-scope']), ts,
		'base::x <- 42\nprint(base::x)',
		emptyGraph()
			.reads('2@x', '1@x'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		} as const
	);
	assertDataflow(label('Simple Assign Break', ['namespaces', 'lexicographic-scope']), ts,
		'x <- 42\nprint(base::x)',
		emptyGraph()
			.reads('2@x', '1@x'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			modifyAnalyzer:        a => {
				a.context().meta.setNamespace('base');
			}
		} as const
	);
	assertDataflow(label('Double Base in Base CTX', ['namespaces', 'lexicographic-scope']), ts,
		'base::x <- 42\nprint(base::x)',
		emptyGraph()
			.reads('2@x', '1@x'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			modifyAnalyzer:        a => {
				a.context().meta.setNamespace('base');
			}
		} as const
	);
	assertDataflow(label('Access base even if overwritten', ['namespaces', 'lexicographic-scope']), ts,
		'library <- function() {}\nbase::library()',
		emptyGraph()
			.addEdge('2@base::library', builtInId('library'), EdgeType.Reads | EdgeType.Calls),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		} as const
	);
	assertDataflow(label('But still relink if not directly!', ['namespaces', 'lexicographic-scope']), ts,
		'library <- function() {}\nlibrary()',
		emptyGraph()
			.addEdge('2@library', '1@library', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		} as const
	);
	assertDataflow(label('work with s3', ['namespaces', 'replacement-functions', 'lexicographic-scope']), ts,
		'`[[<-.foo::bar` <- function() {}\nx[[1]] <- 42',
		emptyGraph()
			.addEdge('2@[[', builtInId('[[<-'), EdgeType.Reads | EdgeType.Calls)
			.reads('2@[[', '1@`[[<-.foo::bar`'),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		} as const
	);
}));
