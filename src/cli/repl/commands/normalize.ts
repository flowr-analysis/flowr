import type { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import type { RShell } from '../../../r-bridge'
import { requestFromInput } from '../../../r-bridge'
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid'

async function normalize(shell: RShell, remainingLine: string) {
	return await new SteppingSlicer({
		stepOfInterest: 'normalize',
		shell,
		request:        requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const normalizeCommand: ReplCommand = {
	description:  'Get mermaid code for the normalized AST of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, remainingLine)

		output.stdout(normalizedAstToMermaid(result.normalize.ast))
	}
}

export const normalizeStarCommand: ReplCommand = {
	description:  'Get a mermaid url of the normalized AST of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, remainingLine)

		output.stdout(normalizedAstToMermaidUrl(result.normalize.ast))
	}
}
