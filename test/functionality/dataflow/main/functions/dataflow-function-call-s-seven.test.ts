import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { isFunctionCallVertex, isFunctionDefinitionVertex } from '../../../../../src/dataflow/graph/vertex';
import { getAllFunctionCallTargets } from '../../../../../src/dataflow/internal/linker';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

describe('S7 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S7 Generic Registration', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="y", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})
sample(42)
`, emptyGraph()
			.addEdge('1@new_generic', '1@function', EdgeType.Returns | EdgeType.Argument)
			.calls('4@sample', '1@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Registration with setGeneric', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- setGeneric("sample", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})
sample(42)
`, emptyGraph()
			.addEdge('1@setGeneric', '1@function', EdgeType.Returns | EdgeType.Argument)
			.calls('4@sample', '1@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S7 Generic Registration with default fn', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="y")
sample(42)
`, emptyGraph()
			.calls('2@sample', '7-s7-new-generic-fun-fdef')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S7 Generic Method  and Call', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="x", function(x) { S7_dispatch() })
		method(sample, class_numeric) <- function(x, ..., na.rm = FALSE) {
		   sum(x) / length(x)
		}
		sample(42)`, emptyGraph()
			.calls('5@sample', '1@function')
			.calls('1@S7_dispatch', '2@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);

	// the constructor-returning S7 factories model their result as a synthetic function definition, so the
	// assigned symbol is recognised as callable (ggplot2 4.0 defines its geoms this way)
	test(label('constructor + function factories recognised as callable definitions', ['function-definitions', 'oop-r7-s7'], ['dataflow']), async() => {
		for(const [code, callName] of [
			['geom_point <- make_constructor(GeomPoint)\ngeom_point(x)', 'geom_point'],   // ggplot2 4.0 / S7
			['Foo <- new_class("Foo")\nFoo()', 'Foo'],                                     // S7
			['Bar <- setClass("Bar", representation(x = "numeric"))\nBar(x = 1)', 'Bar'],  // S4 generator
			['f <- Negate(is.null)\nf(x)', 'f'],                                           // base factory
			['g <- Vectorize(paste)\ng(1)', 'g']                                           // base factory
		] as const) {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(code);
			const g = (await analyzer.dataflow()).graph;
			const call = [...g.vertices(true)].find(([, v]) => isFunctionCallVertex(v) && Identifier.getName(v.name) === callName);
			if(call === undefined) {
				throw new Error(`${callName} call vertex not found`);
			}
			const targets = [...getAllFunctionCallTargets(call[0], g)];
			const resolvesToFdef = targets.some(t => isFunctionDefinitionVertex(g.getVertex(t) ?? { tag: undefined } as never));
			expect(resolvesToFdef, `${callName}() resolves to a (synthetic) function definition`).toBe(true);
		}
	});
}));