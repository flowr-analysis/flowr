import { assert, test } from 'vitest';
import type { Domain, Lift, Value } from '../../../../../src/abstract-interpretation/eval/domain';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import type { RShell } from '../../../../../src/r-bridge/shell';
import type { SingleSlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../../src/slicing/criterion/parse';
import type { PipelineOutput } from '../../../../../src/core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import type { FlowrConfigOptions } from '../../../../../src/config';
import { defaultConfigOptions } from '../../../../../src/config';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import { extractCfg } from '../../../../../src/control-flow/extract-cfg';
import { createDomain, inferStringDomains } from '../../../../../src/abstract-interpretation/eval/inference';

export function createStringDomainAssert<T extends Value>(
	shell: RShell,
	stringDomain: T['kind'],
) {
	return (
		name: string,
		input: string,
		criterion: SingleSlicingCriterion,
		expected: Lift<T>,
	) => {
		test(name, async() => {
			const output: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> = await createDataflowPipeline(shell, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
			const dfg = output.dataflow.graph;
			const normalizedAst = output.normalize;
			const controlFlow = extractCfg(normalizedAst, defaultConfigOptions, dfg);
			const config: FlowrConfigOptions = {
				...defaultConfigOptions,
				abstractInterpretation: {
					...defaultConfigOptions.abstractInterpretation,
					string: {
						domain: stringDomain,
						enable: false,
					},
				},
			};

			const domain = createDomain(config) as Domain<Value>;
			const [valueMap] = inferStringDomains(controlFlow, dfg, normalizedAst, config);
			const nodeId = slicingCriterionToId(criterion, normalizedAst.idMap);
			const value = valueMap.get(nodeId) ?? Top;
			assert(value !== undefined);
			assert(domain.equals(value, expected), `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
		});
	};
}
