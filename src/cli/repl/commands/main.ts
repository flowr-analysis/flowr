import { RShell, TokenMap } from '../../../r-bridge'
import { helpCommand } from './help'
import { quitCommand } from './quit'
import { scripts } from '../../scripts-info'
import { waitOnScript } from '../execute'
import { splitArguments } from '../../../util/args'

/**
 * Content of a single command in the repl.
 */
export interface ReplCommand {
	/** human-readable description of what the command does */
	description:  string
	/** does the command invoke another script? this is mainly used to automatically generate two separate lists when asking for help */
	script:       boolean
	/** example of how to use the command, for example `:slicer --help` */
	usageExample: string
	/** function to execute when the command is invoked */
	fn:           (shell: RShell, tokenMap: TokenMap, remainingLine: string) => Promise<void> | void
}


export const commands: Record<string, ReplCommand> = {
	'help': helpCommand,
	'quit': quitCommand
}


for(const [script, { target, description, type}] of Object.entries(scripts)) {
	if(type === 'master script') {
		commands.script = {
			description,
			script:       true,
			usageExample: `:${script} --help`,
			fn:           async(_s, _t, remainingLine) => {
				await waitOnScript(`${__dirname}/${target}`, splitArguments(remainingLine))
			}
		}
	}
}
