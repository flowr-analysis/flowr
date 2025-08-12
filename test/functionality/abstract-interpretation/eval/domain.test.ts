import { assert, describe, test } from 'vitest';
import { withShell } from '../../_helper/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../../src/config';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import type { StringDomainInfo } from '../../../../src/abstract-interpretation/eval/visitor';
import { StringDomainVisitor } from '../../../../src/abstract-interpretation/eval/visitor';
import type { NormalizedAst, ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import { getVertexRootId } from '../../../../src/control-flow/control-flow-graph';
import { ConstStringDomain } from '../../../../src/abstract-interpretation/eval/domains/constant';
import type { SDRNode } from '../../../../src/abstract-interpretation/eval/domain';

describe('Domain', withShell((shell) => {
	test('Constant Domain', async() => {
		const input = '"test"';
		const output: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> = await createDataflowPipeline(shell, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
		const dfg = output.dataflow.graph;
		const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = output.normalize;
		const controlFlow = extractCfg(normalizedAst, defaultConfigOptions, dfg);
		const visitor = new StringDomainVisitor(new ConstStringDomain(), { controlFlow, dfg, normalizedAst, flowrConfig: defaultConfigOptions });
		visitor.start();

		const exitPoint = controlFlow.graph.getVertex(controlFlow.exitPoints[0]);
		if(!exitPoint) {
			assert(false);
		}
		const exitNode = normalizedAst.idMap.get(getVertexRootId(exitPoint));
		if(!exitNode) {
			assert(false);
		}
		const node = (exitNode.children as SDRNode)[0] as SDRNode;

		assert.deepEqual(node.info.stringdomain?.value, {
			kind:  'const',
			value: 'test'
		});

		// controlFlow.graph.vertices()
		//   .values()
		//   .filter(isNotUndefined)
		//   .map(vertex => normalizedAst.idMap.get(getVertexRootId(vertex)))
		//   .filter(isNotUndefined)
		//   .forEach(node => {
		//     console.log("Node: ", node.lexeme, "\n", node.info.stringdomain)
		//   })
	});
}));

// describe("Domain", withShell((shell) => {
//   test("Constant Domain", () => {
//   })

//   assertSliced(
//     label("paste in eval"),
//     shell,
//     `eval(parse(paste("x <- ", "5",sep="")));\n42`,
//     ["2@42"],
//     "42",
//   )
// }))
