import { assert, describe, test } from "vitest";
import { withShell } from "../../_helper/shell";
import { RShell } from "../../../../src/r-bridge/shell";
import { defaultConfigOptions, FlowrConfigOptions, VariableResolve } from "../../../../src/config";
import { PipelineOutput } from "../../../../src/core/steps/pipeline/pipeline";
import { createDataflowPipeline, DEFAULT_DATAFLOW_PIPELINE } from "../../../../src/core/steps/pipeline/default-pipelines";
import { NormalizedAst, ParentInformation } from "../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate";
import { extractCfg } from "../../../../src/control-flow/extract-cfg";
import { createDomain, inferStringDomains } from "../../../../src/abstract-interpretation/eval/inference";
import { slicingCriterionToId } from "../../../../src/slicing/criterion/parse";
import { requestFromInput } from "../../../../src/r-bridge/retriever";
import { Top } from "../../../../src/abstract-interpretation/eval/domain";

function assertPrintedValue(
	name: string,
	shell: RShell,
	stringDomain: FlowrConfigOptions["abstractInterpretation"]["string"]["domain"],
	input: string,
) {
  test(name, async () => {
  	const src = `print(paste0(${input}))`;
  	const output: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> = await createDataflowPipeline(shell, { request: requestFromInput(src) }, defaultConfigOptions).allRemainingSteps();
  	const dfg = output.dataflow.graph;
  	const normalizedAst: NormalizedAst<ParentInformation> = output.normalize;
  	const controlFlow = extractCfg(normalizedAst, defaultConfigOptions, dfg);
  	const config: FlowrConfigOptions = {
  		...defaultConfigOptions,
  		abstractInterpretation: {
  			...defaultConfigOptions.abstractInterpretation,
  			string: {
  				domain: stringDomain
  			},
  		},
  	};
  	const domain = createDomain(config)!;
  	const valuesMap = inferStringDomains(controlFlow, dfg, normalizedAst, config);

  	const cmdOut = await shell.sendCommandWithOutput(src);
  	assert(cmdOut.length === 1, "Expected exactly one line of output");
  	const expectedValue = domain.infer({ type: "const", value: cmdOut[0].substring(5, cmdOut[0].length - 1) }, new Map());

  	const nodeId = slicingCriterionToId("1:7", normalizedAst.idMap);
		const actualValue = valuesMap.get(nodeId) ?? Top;
  	assert(domain.equals(actualValue, expectedValue), `Expected printed value to be "${JSON.stringify(expectedValue)}", but got "${JSON.stringify(actualValue)}"`);
  })
}

describe.sequential('implicit-string-conversion', withShell((shell) => {
  const TEST_VALUES = [
    "\"foobar\"",
    "5",
    "5.0",
    "TRUE",
    "FALSE",
    "2.3",
    "42.825",
  ];
  
  for (const testValue of TEST_VALUES) {
    assertPrintedValue(
      "string",
      shell,
      "const",
      testValue,
    )

    assertPrintedValue(
      "string",
      shell,
      "const-set",
      testValue,
    )
  }
}))
