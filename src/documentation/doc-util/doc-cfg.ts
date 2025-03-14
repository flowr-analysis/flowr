import type { ControlFlowInformation } from '../../util/cfg/cfg';
import { extractCFG } from '../../util/cfg/cfg';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import type { RShell } from '../../r-bridge/shell';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

export async function getCfg(shell: RShell, code: string): Promise<{
	info: ControlFlowInformation,
	ast:  NormalizedAst
}> {
	const steps = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:  shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	return {
		info: extractCFG(steps.normalize, steps.dataflow?.graph),
		ast:  steps.normalize
	};
}
