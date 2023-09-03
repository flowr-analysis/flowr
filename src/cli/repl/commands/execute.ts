import { RShell } from '../../../r-bridge'
import { italic } from '../../../statistics'
import { ReplCommand, ReplOutput } from './main'


export async function executeRShellCommand(output: ReplOutput, shell: RShell, statement: string) {
	try {
		const result = await shell.sendCommandWithOutput(statement, {
			from:                    'both',
			automaticallyTrimOutput: true
		})
		output.stdout(`${italic(result.join('\n'))}\n`)
	} catch(e) {
		output.stderr(`Error while executing '${statement}': ${(e as Error).message}`)
	}
}


export const executeCommand: ReplCommand = {
	description:  'Execute the given code as R code (essentially similar to using now command)',
	usageExample: ':execute',
	aliases:      [ 'e', 'r' ],
	script:       false,
	fn:           async(output, shell, _tokenMap, remainingLine) => {
		await executeRShellCommand(output, shell, remainingLine)
	}
}
