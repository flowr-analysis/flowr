import { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import { requestFromInput, RShell, TokenMap } from '../../../r-bridge'
import {
	graphToMermaid,
	graphToMermaidUrl
} from '../../../util/mermaid'

async function dataflow(shell: RShell, tokenMap: TokenMap, remainingLine: string) {
	return await new SteppingSlicer({
		stepOfInterest: 'dataflow',
		shell, tokenMap,
		request:        requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const dataflowCommand: ReplCommand = {
	description:  'Get mermaid code for the dataflow graph of R code, start with \'file://\' to indicate a file.',
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await dataflow(shell, tokenMap, remainingLine)

		output.stdout(graphToMermaid(result.dataflow.graph, result.normalize.idMap, undefined, undefined, false))
	}
}

export const dataflowStarCommand: ReplCommand = {
	description:  'Get a mermaid url of the dataflow graph of R code, start with \'file://\' to indicate a file.',
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await dataflow(shell, tokenMap, remainingLine)

		output.stdout(graphToMermaidUrl(result.dataflow.graph, result.normalize.idMap, false))
	}
}
