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
	description:  'Get mermaid code for the control-flow graph of R code, start with \'file://\' to indicate a file.',
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
	description:  'Get a mermaid url of the control-flow graph of R code, start with \'file://\' to indicate a file.',
	usageExample: ':controlflow',
	aliases:      [ 'cfg*' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await controlflow(shell, tokenMap, remainingLine)

		const cfg = extractCFG(result.normalize)
		output.stdout(cfgToMermaidUrl(cfg))
	}
}
