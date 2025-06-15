import { assert, describe, it } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { SemanticCfgGuidedVisitor } from '../../../src/control-flow/semantic-cfg-guided-visitor';
import type {
	TREE_SITTER_DATAFLOW_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines';
import {
	createDataflowPipeline
} from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import type { ControlFlowInformation } from '../../../src/control-flow/control-flow-graph';
import type { DataflowGraphVertexValue } from '../../../src/dataflow/graph/vertex';
import type { RNumber } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { graphToMermaidUrl } from '../../../src/util/mermaid/dfg';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';

describe('SemanticCfgGuidedVisitor', withTreeSitter(ts => {

	function testSemanticVisitor<V extends SemanticCfgGuidedVisitor>(code: string, visitor: (o: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE>, controlFlow: ControlFlowInformation) => V, assert: (obj: V) => void) {
		it(code, async() => {
			const data = await createDataflowPipeline(ts, { request: requestFromInput(code) }).allRemainingSteps();
			const cfg = extractCfg(data.normalize, data.dataflow.graph);
			const v = visitor(data, cfg);
			v.start();
			try {
				assert(v);
			} catch(error) {
				console.error('dfg: ', graphToMermaidUrl(data.dataflow.graph));
				console.error('cfg: ', cfgToMermaidUrl(cfg, data.normalize));
				throw error;
			}
		});
	}

	testSemanticVisitor('1 + 2 + 3', ({ dataflow, normalize }, controlFlow) => new class extends SemanticCfgGuidedVisitor {
		private collect: number[] = [];

		constructor() {
			super({ defaultVisitingOrder: 'forward', controlFlow, dfg: dataflow.graph, normalizedAst: normalize });
		}

		protected onNumberConstant(d: { vertex: DataflowGraphVertexValue; node: RNumber }) {
			super.onNumberConstant(d);
			this.collect.push(d.node.content.num);
		}

		public getCollected(): number[] {
			return this.collect;
		}
	}(), o => {
		assert.deepStrictEqual(o.getCollected(), [1, 2, 3]);
	});


	testSemanticVisitor('NULL', ({ dataflow, normalize }, controlFlow) => new class extends SemanticCfgGuidedVisitor {
		private foundNull = false;

		constructor() {
			super({ defaultVisitingOrder: 'forward', controlFlow, dfg: dataflow.graph, normalizedAst: normalize });
		}

		protected onNullConstant() {
			this.foundNull = true;
		}

		public encounteredNull(): boolean {
			return this.foundNull;
		}
	}(), o => {
		assert.isTrue(o.encounteredNull());
	});

	describe('Symbol constants', () => {
		describe.each(['l <- list(1, 2, 3); l$a', 'library(foo)'])('For: %s', code => {
			testSemanticVisitor(code, ({ dataflow, normalize }, controlFlow) => new class extends SemanticCfgGuidedVisitor {
				private triggered = false;

				constructor() {
					super({
						defaultVisitingOrder: 'forward',
						controlFlow,
						dfg:                  dataflow.graph,
						normalizedAst:        normalize
					});
				}

				protected onSymbolConstant(_data: { vertex: DataflowGraphVertexValue; node: RSymbol }) {
					this.triggered = true;
				}

				public isTriggered(): boolean {
					return this.triggered;
				}
			}(), o => {
				assert.isTrue(o.isTriggered());
			});
		});
	});

	testSemanticVisitor('v <- c(1,2,3)\nv[]', ({ dataflow, normalize }, controlFlow) => new class extends SemanticCfgGuidedVisitor {
		private found = false;

		constructor() {
			super({ defaultVisitingOrder: 'forward', controlFlow, dfg: dataflow.graph, normalizedAst: normalize });
		}

		protected onAccessCall() {
			this.found = true;
		}

		public foundAccess(): boolean {
			return this.found;
		}
	}(), o => {
		assert.isTrue(o.foundAccess());
	});
}));