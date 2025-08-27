

import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { CallGraph } from '../../../../src/dataflow/call-graph/call-graph';
import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { guard } from '../../../../src/util/assert';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../../src/config';
import { decorateLabelContext } from '../../_helper/label';
import { mermaidCodeToUrl } from '../../../../src/util/mermaid/mermaid';
import { normalizedAstToMermaidUrl } from '../../../../src/util/mermaid/ast';

describe('Call Graph', withTreeSitter(parser => {
	function testCg(code: string, cg: (dfg: DataflowGraph) => CallGraph) {
		const effectiveName = decorateLabelContext(code, ['other']);
		test(effectiveName, async() => {
			const result = await createDataflowPipeline(parser, {
				request: requestFromInput(code)
			}, defaultConfigOptions).allRemainingSteps();
			const gotGraph = CallGraph.create(result.dataflow.graph);
			try {
				assert.strictEqual(JSON.stringify(gotGraph), JSON.stringify(cg(result.dataflow.graph)));
			} catch(error) {
				console.log('cg: ', mermaidCodeToUrl(gotGraph.toMermaid(result.dataflow.graph)));
				console.log('normalized: ', normalizedAstToMermaidUrl(result.normalize.ast));
				throw error; // Re-throw the error after logging it
			}
		});
	}

	class CGB extends CallGraph {
		private readonly idm: AstIdMap;
		public constructor(dfg: DataflowGraph) {
			super();
			guard(dfg.idMap !== undefined);
			this.idm = dfg.idMap;
		}

		public e(from: SingleSlicingCriterion | string, to: SingleSlicingCriterion | string): this {
			const f = tryResolveSliceCriterionToId(from, this.idm) ?? from;
			const t = tryResolveSliceCriterionToId(to, this.idm) ?? to;
			return this.addEdge(f, t);
		}
	}


	testCg('f <- function() { return 1; }\n f();', d => new CGB(d)
		.e('$5', 'builtin:expression-list')
		.e('1@function', '$5')
		.e('1@<-', 'builtin:assignment')
		.e('2@f', '1@function'));



}));
