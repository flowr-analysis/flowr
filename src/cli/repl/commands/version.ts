import { ReplCommand } from './main'
import { RShell } from '../../../r-bridge'
import { version } from '../../../../package.json'
import { guard } from '../../../util/assert'

type Version = `${number}.${number}.${number}`

/**
 * Describes the version of flowR and the used R interpreter.
 */
export interface VersionInformation {
	/** The version of flowR */
	flowr: Version,
	/** The version of R identified by the underlying {@link RShell} */
	r:     Version | 'unknown'
}

const versionRegex = /^\d+\.\d+\.\d+/m

export async function retrieveVersionInformation(shell?: RShell): Promise<VersionInformation> {
	if(shell === undefined) {
		shell = new RShell()
		process.on('exit', () => (shell as RShell).close())
	}
	const flowr = version
	const r = (await shell.usedRVersion())?.format() ?? 'unknown'

	guard(versionRegex.test(flowr), `flowR version ${flowr} does not match the expected format!`)
	guard(r === 'unknown' || versionRegex.test(r), `R version ${r} does not match the expected format!`)

	return { flowr: flowr as Version, r: r as Version }
}

export async function printVersionInformation(shell?: RShell) {
	const { flowr, r } = await retrieveVersionInformation(shell)
	console.log(`flowR: ${flowr}`)
	console.log(`R: ${r}`)
}


export const versionCommand: ReplCommand = {
	description:  'Prints the version of flowR as well as the current version of R',
	aliases:      [],
	usageExample: ':version',
	script:       false,
	fn:           shell => printVersionInformation(shell)
}
