import { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import { requestFromInput, RShell, TokenMap } from '../../../r-bridge'
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid'

async function normalize(shell: RShell, tokenMap: TokenMap, remainingLine: string) {
	return await new SteppingSlicer({
		stepOfInterest: 'normalize',
		shell, tokenMap,
		request:        requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const normalizeCommand: ReplCommand = {
	description:  'Return mermaid code that renders the normalized AST of the given R code',
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await normalize(shell, tokenMap, remainingLine)

		output.stdout(normalizedAstToMermaid(result.normalize.ast))
	}
}

export const normalizeStarCommand: ReplCommand = {
	description:  'Return mermaid url that leads to mermaid live to render the normalized AST of the given R code',
	usageExample: ':normalize',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async(output, shell, tokenMap, remainingLine) => {
		const result = await normalize(shell, tokenMap, remainingLine)

		output.stdout(normalizedAstToMermaidUrl(result.normalize.ast))
	}
}
