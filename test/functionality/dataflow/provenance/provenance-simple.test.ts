import { describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { calculateProvenance } from '../../../../src/dataflow/graph/provenance-graph';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import { guard } from '../../../../src/util/assert';
import { graphToMermaidUrl } from '../../../../src/util/mermaid/dfg';

describe('Provenance Test', withTreeSitter((ts => {
	function assertProvenance(code: string, provenanceFor: SingleSlicingCriterion): void {
		test(code, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(code);
			const df = await analyzer.dataflow();
			const nast = await analyzer.normalize();
			const provenanceId = tryResolveSliceCriterionToId(provenanceFor, nast.idMap);
			guard(provenanceId !== undefined, `could not resolve slicing criterion ${provenanceFor} to an id`);
			const provenance = calculateProvenance(
				provenanceId,
				df,
				nast,
				analyzer.context()
			);
			console.log(graphToMermaidUrl(provenance));
		});
	}

	assertProvenance('x <- 2\nprint(x)', '2@x');
})));