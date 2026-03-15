import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { guard } from '../../../../src/util/assert';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';

describe('Provenance Test', withTreeSitter((ts => {
	function assertProvenance(code: string, provenanceFor: SingleSlicingCriterion, subgraph: DataflowGraph): void {
		test(code, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(code);
			const df = await analyzer.dataflow();
			const nast = await analyzer.normalize();
			const provenanceId = SingleSlicingCriterion.tryParse(provenanceFor, nast.idMap);
			guard(provenanceId !== undefined, `could not resolve slicing criterion ${provenanceFor} to an id`);
			const provenanceNode = nast.idMap.get(provenanceId);
			guard(provenanceNode !== undefined, `could not find node for id ${provenanceId}`);
			const fdef = RFunctionDefinition.wrappingFunctionDefinition(provenanceNode, nast.idMap);
			const provenance = Dataflow.provenanceGraph(
				provenanceId,
				df.graph,
				fdef ? RNode.collectAllIds(fdef) : undefined
			);
			const resolvedExpect = Dataflow.resolveGraphCriteria(subgraph, analyzer.inspectContext(), nast.idMap);
			const d = Dataflow.diffGraphs({
				name:  'expected',
				graph: resolvedExpect
			}, {
				name:  'got',
				graph: provenance
			}, { leftIsSubgraph: true });
			assert.isTrue(d.isEqual(), `provenance does not match expected result. Got: \n${Dataflow.visualize.mermaid.url(provenance)}`);
		});
	}

	assertProvenance('x <- 2\nprint(x)', '2@x',
		Dataflow.create.empty()
			.use('2@x')
			.defineVariable('1@x')
			.reads('2@x', '1@x')
	);
	assertProvenance(`f <- function(x, y) {
	x <- foo(x);
	eval(x)
}`, '3@x',
	Dataflow.create.empty()
		.use('3@x')
		.defineVariable('2@x')
		.defineVariable('1@x')
	);
})));