import { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import { requestFromInput, RShell, TokenMap } from '../../../r-bridge'
import {
	cfgToMermaid, cfgToMermaidUrl
} from '../../../util/mermaid'
import { extractCFG } from '../../../util/cfg'

async function controlflow(shell: RShell, tokenMap: TokenMap, remainingLine: string) {
	return await new SteppingSlicer({
		stepOfInterest: 'normalize',
		shell, tokenMap,
		request:        requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const controlflowCommand: ReplCommand = {
	description:  'Return mermaid code that renders the control-flow graph of the given R code',
	usageExample: ':controlflow',
	aliases:      [ 'cfg' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await controlflow(shell, tokenMap, remainingLine)

		const cfg = extractCFG(result.normalize)
		output.stdout(cfgToMermaid(cfg))
	}
}

export const controlflowStarCommand: ReplCommand = {
	description:  'Return mermaid url that leads to mermaid live to render the control-flow graph of the given R code',
	usageExample: ':controlflow',
	aliases:      [ 'cfg*' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await controlflow(shell, tokenMap, remainingLine)

		const cfg = extractCFG(result.normalize)
		output.stdout(cfgToMermaidUrl(cfg))
	}
}
