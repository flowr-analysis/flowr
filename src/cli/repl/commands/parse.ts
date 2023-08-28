import { ReplCommand } from './main'
import { requestFromInput } from '../../../r-bridge'
import { SteppingSlicer } from '../../../core'



export const parseCommand: ReplCommand = {
	description:  'Prints ASCII Art of the parsed, unmodified AST. Start with \'file://\' to indicate a file path',
	usageExample: ':parse',
	script:       false,
	fn:           async(shell, tokenMap, remainingLine) => {
		const result = await new SteppingSlicer({
			stepOfInterest: 'parse',
			shell,
			tokenMap,
			request:        requestFromInput(remainingLine.trim())
		}).allRemainingSteps()

		// TODO: ASCII art
		console.log(result.parse)
	}
}
