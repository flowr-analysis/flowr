import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from './_helper/shell';
import { EdgeType } from '../../src/dataflow/graph/edge';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { emptyGraph } from '../../src/dataflow/graph/dataflowgraph-builder';
import { label } from './_helper/label';
import { argumentInCall, defaultEnv } from './_helper/dataflow/environment-builder';
import { NodeId } from '../../src/r-bridge/lang-4.x/ast/model/processing/node-id';


describe('Lax Parser', withTreeSitter(ts => {

	assertDataflow(label('Without lax parser - simple'), ts, 'a <- 4 € b <- 3\nt <- "hallo"',
		emptyGraph(),
		{
			expectIsSubgraph:      false,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Simple test'), ts, '',
		emptyGraph()
			.addEdge('1@a', '1@4', EdgeType.DefinedBy)
			.addEdge('1@b', '1@3', EdgeType.DefinedBy)
			.addEdge('2@t', '2@"hallo"', EdgeType.DefinedBy),
		{
			modifyAnalyzer: _ => {
				const analyzer = new FlowrAnalyzerBuilder().setParser(ts)
					.configure('engines', [{ type: 'tree-sitter', lax: true }])
					.buildSync();
				analyzer.addRequest('a <- 4 € b <- 3\nt <- "hallo"');
				return analyzer;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Without lax parser - for, if'), ts, `t <- 0
	for(x in 1:5)
		t <- 4
		if(x == 3){
			t <- t ++ 3
		}
	}
	print(t)`,
	emptyGraph(),
	{
		expectIsSubgraph:      false,
		resolveIdsAsCriterion: true
	}
	);

	assertDataflow(label('For - if'), ts, '',
		emptyGraph()
			.addEdge('1@t', '1@0', EdgeType.DefinedBy)
			.addEdge('3@t', '3@4', EdgeType.DefinedBy)
			.addEdge('8@t', '1@t', EdgeType.Reads)
			.addEdge('8@t', '3@t', EdgeType.Reads)
			.addEdge('8@t', '5@t', EdgeType.Reads)
			.addEdge('4@if', '4@==', EdgeType.Reads |EdgeType.Argument)
			.addEdge('4@==', '4@x', EdgeType.Reads |EdgeType.Argument)
			.addEdge('4@==', '4@3', EdgeType.Reads |EdgeType.Argument)
			.addEdge('8@print', '8@t', EdgeType.Reads |EdgeType.Returns |EdgeType.Argument)
			.call('2@:', ':', [argumentInCall(4), argumentInCall(5)], { returns: [], reads: [NodeId.toBuiltIn(':'), 4, 5], onlyBuiltIn: true })
			.calls('2@:', NodeId.toBuiltIn(':'))
			.call('2@for', 'for', [argumentInCall(3), argumentInCall(6)], { returns: [], reads: [NodeId.toBuiltIn('for'), 11], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', 3) })
			.addEdge('2@for', '2@:', EdgeType.Reads)
			.calls(11, NodeId.toBuiltIn('for'))
			.defineVariable('5@t')
			.addControlDependency('5@t', 24, true)
			.defineVariable('3@t')
			.addControlDependency('3@t', 11, true),

		{
			modifyAnalyzer: _ => {
				const analyzer = new FlowrAnalyzerBuilder().setParser(ts)
					.configure('engines', [{ type: 'tree-sitter', lax: true }])
					.buildSync();
				analyzer.addRequest(`t <- 0
					for(x in 1:5) 
					t <- 4
					if(x == 3){
						t <- t ++ 3
					}
				}
				print(t)`);
				return analyzer;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('For - faulty if'), ts, '',
		emptyGraph()
			.addEdge('1@t', '1@0', EdgeType.DefinedBy)
			.addEdge('3@t', '3@4', EdgeType.DefinedBy)
			.call('2@:', ':', [argumentInCall(4), argumentInCall(5)], { returns: [], reads: [NodeId.toBuiltIn(':'), 4, 5], onlyBuiltIn: true })
			.calls('2@:', NodeId.toBuiltIn(':'))
			.call('2@for', 'for', [argumentInCall(3), argumentInCall(6)], { returns: [], reads: [NodeId.toBuiltIn('for'), 11], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', 3) })
			.addEdge('2@for', '2@:', EdgeType.Reads)
			.calls(11, NodeId.toBuiltIn('for')),
		{
			modifyAnalyzer: _ => {
				const analyzer = new FlowrAnalyzerBuilder().setParser(ts)
					.configure('engines', [{ type: 'tree-sitter', lax: true }])
					.buildSync();
				analyzer.addRequest(`t <- 0
					for(x in 1:5)
					t <- 4
					if(x == 3{
						t <- t ++ 3
					}
				}
				print(t)`);
				return analyzer;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Without lax parser - conditions'), ts, `if(x == 3){
		t <- 3
	}
		else if {
			t <- 4
		}
		else 
			t <- 5
		}
		if 3 > 4){
			t <- 6
		print(t)`,
	emptyGraph(),
	{
		expectIsSubgraph:      false,
		resolveIdsAsCriterion: true
	}
	);

	assertDataflow(label('Conditions'), ts, '',
		emptyGraph()
			.addEdge('1@if', '1@==', EdgeType.Reads |EdgeType.Argument)
			.addEdge('2@t', '2@3', EdgeType.DefinedBy)
			.addEdge('5@t', '5@4', EdgeType.DefinedBy)
			.defineVariable('2@t')
			.addControlDependency('2@t', 9, true)
			.addEdge('11@t', '11@6', EdgeType.DefinedBy)
			.addEdge('12@print', '12@t', EdgeType.Reads |EdgeType.Argument |EdgeType.Returns),
		{
			modifyAnalyzer: _ => {
				const analyzer = new FlowrAnalyzerBuilder().setParser(ts)
					.configure('engines', [{ type: 'tree-sitter', lax: true }])
					.buildSync();
				analyzer.addRequest(`if(x == 3){
		t <- 3
	}
		else if {
			t <- 4
		}
		else 
			t <- 5
		}
		if 3 > 4){
			t <- 6
		print(t)`);
				return analyzer;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);

	assertDataflow(label('Without lax parser - conditions 2'), ts, `for(a in 15){
		a <- a€2
		if(a == 15){
			c <- a
		}
		b <- 4
	}`,
	emptyGraph(),
	{
		expectIsSubgraph:      false,
		resolveIdsAsCriterion: true
	}
	);

	assertDataflow(label('conditions 2'), ts, '',
		emptyGraph()
			.defineVariable('2@a')
			.addControlDependency('2@a', 22, true)
			.use('4@a')
			.addControlDependency('4@a', 17, true)
			.addControlDependency('4@a', 22, true)
			.addEdge('6@b', '6@4', EdgeType.DefinedBy),
		{
			modifyAnalyzer: _ => {
				const analyzer = new FlowrAnalyzerBuilder().setParser(ts)
					.configure('engines', [{ type: 'tree-sitter', lax: true }])
					.buildSync();
				analyzer.addRequest(`for(a in 15){
		a <- a€2
		if(a == 15){
			c <- a
		}
		b <- 4
	}`);
				return analyzer;
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
}));