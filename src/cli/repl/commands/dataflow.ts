import type { ReplCommand } from './main'
import type { RShell } from '../../../r-bridge'
import { fileProtocol, requestFromInput } from '../../../r-bridge'
import { PipelineExecutor } from '../../../core/pipeline-executor'
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline'
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid'

async function dataflow(shell: RShell, remainingLine: string) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const dataflowCommand: ReplCommand = {
	description:  `Get mermaid code for the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, remainingLine)

		output.stdout(graphToMermaid({ graph: result.dataflow.graph, includeEnvironments: false }).string)
	}
}

export const dataflowStarCommand: ReplCommand = {
	description:  `Get a mermaid url of the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, remainingLine)

		output.stdout(graphToMermaidUrl(result.dataflow.graph, false))
	}
}
