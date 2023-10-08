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
	description:  'Return mermaid code that renders the dataflow graph of the given R code',
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await dataflow(shell, tokenMap, remainingLine)

		output.stdout(graphToMermaid(result.dataflow.graph, result.normalize.idMap, undefined, undefined, false))
	}
}

export const dataflowStarCommand: ReplCommand = {
	description:  'Return mermaid url that leads to mermaid live to render the dataflow graph of the given R code',
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await dataflow(shell, tokenMap, remainingLine)

		output.stdout(graphToMermaidUrl(result.dataflow.graph, result.normalize.idMap, false))
	}
}
