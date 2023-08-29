import { ReplCommand } from './main'
import { RShell } from '../../../r-bridge'
import { version } from '../../../../package.json'

export async function printVersionInformation(shell?: RShell) {
	console.log(`flowR: ${String(version)}`)
	if(shell === undefined) {
		shell = new RShell()
		process.on('exit', () => (shell as RShell).close())
	}
	const rVersion = await shell.usedRVersion()
	console.log(`R: ${rVersion?.format() ?? 'unknown'}`)
}


export const versionCommand: ReplCommand = {
	description:  'Prints the version of flowR as well as the current version of R',
	aliases:      [],
	usageExample: ':version',
	script:       false,
	fn:           shell => printVersionInformation(shell)
}
