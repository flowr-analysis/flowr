import { rawPrompt } from '../prompt'
import { bold, italic } from '../../../statistics'
import { commands, ReplCommand } from './main'



const longestKey = Array.from(Object.keys(commands), k => k.length).reduce((p, n) => Math.max(p, n), 0)
function padCmd<T>(string: T) {
	return String(string).padEnd(longestKey + 2, ' ')
}

export const helpCommand: ReplCommand = {
	description:  'Show help information',
	script:       false,
	usageExample: ':help',
	fn:           () => {
		console.log(`
You can always just enter a R expression which gets evaluated:
${rawPrompt} ${bold('1 + 1')}
${italic('[1] 2')}

Besides that, you can use the following commands. The scripts ${italic('can')} accept further arguments. There are the following basic commands:
${
	Array.from(Object.entries(commands)).filter(([, {script}]) => !script).map(
		([command, { description }]) => `  ${bold(padCmd(':' + command))}${description}`).join('\n')
}
Furthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add ${italic('--help')} after the command.
${
	Array.from(Object.entries(commands)).filter(([, {script}]) => script).map(
		([command, { description }]) => `  ${bold(padCmd(':' + command))}${description}`).join('\n')
}
`)
	}
}

