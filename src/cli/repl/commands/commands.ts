import { quitCommand } from './quit'
import { scripts } from '../../common'
import { waitOnScript } from '../execute'
import { splitArguments } from '../../../util/args'
import { ReplCommand } from './main'
import { rawPrompt } from '../prompt'
import { bold, italic } from '../../../statistics'
import { versionCommand } from './version'
import { parseCommand } from './parse'

function printHelpForScript(script: [string, ReplCommand]): string {
	const base = `  ${bold(padCmd(':' + script[0]))}${script[1].description}`
	if(script[1].aliases.length === 0) {
		return base
	}
	const aliases = script[1].aliases
	return `${base} (aliase${aliases.length > 1 ? 's' : ''}: ${aliases.map(a => bold(':' + a)).join(', ')})`
}

export const helpCommand: ReplCommand = {
	description:  'Show help information',
	script:       false,
	usageExample: ':help',
	aliases:      [ 'h', '?' ],
	fn:           () => {
		console.log(`
You can always just enter R expressions which get evaluated right away:
${rawPrompt} ${bold('1 + 1')}
${italic('[1] 2')}

Besides that, you can use the following commands. The scripts ${italic('can')} accept further arguments. There are the following basic commands:
${
	Array.from(Object.entries(commands)).filter(([, {script}]) => !script).map(
		printHelpForScript).join('\n')
}
Furthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add ${italic('--help')} after the command.
${
	Array.from(Object.entries(commands)).filter(([, {script}]) => script).map(
		([command, { description }]) => `  ${bold(padCmd(':' + command))}${description}`).join('\n')
}
`)
	}
}



const commands: Record<string, ReplCommand> = {
	'help':    helpCommand,
	'quit':    quitCommand,
	'version': versionCommand,
	'parse':   parseCommand
}

for(const [script, { target, description, type}] of Object.entries(scripts)) {
	if(type === 'master script') {
		commands[script] = {
			description,
			aliases:      [],
			script:       true,
			usageExample: `:${script} --help`,
			fn:           async(_s, _t, remainingLine) => {
				await waitOnScript(`${__dirname}/../../${target}`, splitArguments(remainingLine))
			}
		}
	}
}


/**
 * The names of all commands including their aliases (but without the leading `:`)
 */
export const commandNames: string[] = []
// maps command names or aliases to the actual command name
const commandMapping: Record<string, string> = {}

for(const [command, { aliases }] of Object.entries(commands)) {
	commandMapping[command] = command
	for(const alias of aliases) {
		commandMapping[alias] = command
	}
	commandNames.push(command)
	commandNames.push(...aliases)
}

/**
 * Get the command for a given command name or alias.
 * @param command - The name of the command (without the leading `:`)
 */
export function getCommand(command: string): ReplCommand | undefined {
	return commands[commandMapping[command]]
}


const longestKey = Array.from(Object.keys(commands), k => k.length).reduce((p, n) => Math.max(p, n), 0)
function padCmd<T>(string: T) {
	return String(string).padEnd(longestKey + 2, ' ')
}
