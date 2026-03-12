import { describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { calculateProvenance } from '../../../../src/dataflow/graph/provenance-graph';
import { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { guard } from '../../../../src/util/assert';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';

describe('Provenance Test', withTreeSitter((ts => {
	function assertProvenance(code: string, provenanceFor: SingleSlicingCriterion): void {
		test(code, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(code);
			const df = await analyzer.dataflow();
			const nast = await analyzer.normalize();
			const provenanceId = SingleSlicingCriterion.tryParse(provenanceFor, nast.idMap);
			guard(provenanceId !== undefined, `could not resolve slicing criterion ${provenanceFor} to an id`);
			// TODO: move this to helper object
			const provenance = calculateProvenance(
				provenanceId,
				df.graph,
				nast.idMap
			);
			console.log(Dataflow.visualize.mermaid.url(provenance));
		});
	}

	assertProvenance('x <- 2\nprint(x)', '2@x');
})));