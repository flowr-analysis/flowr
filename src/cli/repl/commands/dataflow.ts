import type { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import type { RShell } from '../../../r-bridge'
import { fileProtocol , requestFromInput } from '../../../r-bridge'
import {
	graphToMermaid,
	graphToMermaidUrl
} from '../../../util/mermaid/dfg'

async function dataflow(shell: RShell, remainingLine: string) {
	return await new SteppingSlicer({
		stepOfInterest: 'dataflow',
		shell,
		request:        requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const dataflowCommand: ReplCommand = {
	description:  `Get mermaid code for the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, remainingLine)

		output.stdout(graphToMermaid(result.dataflow.graph, result.normalize.idMap, undefined, undefined, false))
	}
}

export const dataflowStarCommand: ReplCommand = {
	description:  `Get a mermaid url of the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, remainingLine)

		output.stdout(graphToMermaidUrl(result.dataflow.graph, result.normalize.idMap, false))
	}
}
