import { RShell } from '../../../r-bridge'
import { italic } from '../../../statistics'
import { ReplCommand } from './main'


export async function executeRShellCommand(shell: RShell, statement: string) {
	try {
		const result = await shell.sendCommandWithOutput(statement, {
			from:                    'both',
			automaticallyTrimOutput: true
		})
		console.log(`${italic(result.join('\n'))}\n`)
	} catch(e) {
		console.error(`Error while executing '${statement}': ${(e as Error).message}`)
	}
}


export const executeCommand: ReplCommand = {
	description:  'Execute the given code as R code (essentially similar to using now command)',
	usageExample: ':execute',
	aliases:      [ 'e', 'r' ],
	script:       false,
	fn:           async(shell, _tokenMap, remainingLine) => {
		await executeRShellCommand(shell, remainingLine)
	}
}
