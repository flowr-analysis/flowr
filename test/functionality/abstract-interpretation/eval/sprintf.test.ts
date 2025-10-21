import { assert, describe, test } from "vitest";
import { withShell } from "../../_helper/shell";
import { RShell } from "../../../../src/r-bridge/shell";
import { defaultConfigOptions, FlowrConfigOptions, VariableResolve } from "../../../../src/config";
import { SDValue } from "../../../../src/abstract-interpretation/eval/domain";
import { PipelineOutput } from "../../../../src/core/steps/pipeline/pipeline";
import { createDataflowPipeline, DEFAULT_DATAFLOW_PIPELINE } from "../../../../src/core/steps/pipeline/default-pipelines";
import { NormalizedAst, ParentInformation } from "../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate";
import { resolveNodeToStringImplicit, StringDomainInfo } from "../../../../src/abstract-interpretation/eval/visitor";
import { extractCfg } from "../../../../src/control-flow/extract-cfg";
import { createDomain, inferStringDomains } from "../../../../src/abstract-interpretation/eval/inference";
import { slicingCriterionToId } from "../../../../src/slicing/criterion/parse";
import { sdEqual } from "../../../../src/abstract-interpretation/eval/equality";
import { requestFromInput } from "../../../../src/r-bridge/retriever";

function assertPrintedValue(
	name: string,
	shell: RShell,
	stringDomain: FlowrConfigOptions["abstractInterpretation"]["string"]["domain"],
	fmt: string,
	...args: (string | number)[]
) {
  test(name, async () => {
  	const src = `print(sprintf(${[fmt, ...args].join(", ")}))`;
  	const output: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> = await createDataflowPipeline(shell, { request: requestFromInput(src) }, defaultConfigOptions).allRemainingSteps();
  	const dfg = output.dataflow.graph;
  	const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = output.normalize;
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
  	inferStringDomains(controlFlow, dfg, normalizedAst, config);

  	const cmdOut = await shell.sendCommandWithOutput(src);
  	assert(cmdOut.length === 1, "Expected exactly one line of output");
  	const expectedValue = domain.const(cmdOut[0].substring(5, cmdOut[0].length - 1));

  	const nodeId = slicingCriterionToId("1:7", normalizedAst.idMap);
		const node = normalizedAst.idMap.get(nodeId);
		const actualValue = node?.info.sdvalue;
  	assert(sdEqual(actualValue, expectedValue), `Expected printed value to be "${JSON.stringify(expectedValue)}", but got "${JSON.stringify(actualValue)}"`);
  })
}

describe.sequential('implicit-string-conversion', withShell((shell) => {
  const TEST_VALUES = [
    ["\"%s\"", "\"foobar\""],
    ["\"%d\"", "5"],
    ["\"%x\"", "15"],
    ["\"%.2f\"", "0.33333"],
  ]
  
  for (const [fmt, arg] of TEST_VALUES) {
    assertPrintedValue(
      `sprintf-${fmt}-${arg}`,
      shell,
      "const",
      fmt,
      arg
    )
  }
  
  for (const [fmt, arg] of TEST_VALUES) {
    assertPrintedValue(
      `sprintf-${fmt}-${arg}`,
      shell,
      "const-set",
      fmt,
      arg
    )
  }
}))
