/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 *
 * @module
 */
import { getStoredTokenMap, RShell, TokenMap } from '../r-bridge'
import readline from 'readline/promises'
import { bold, ColorEffect, Colors, formatter, italic } from '../statistics'
import { log } from '../util/log'
import cp from 'child_process'
import { splitArguments } from '../util/args'

// TODO: find one location for all of these documentation etc.
export const validScripts = new Map<string, { target: string, description: string }>()
validScripts.set('slicer',           { target: 'slicer-app', description: 'Slice a given file' })
validScripts.set('benchmark',        { target: 'benchmark-app', description: 'Allows to benchmark the static program slicer' })
validScripts.set('summarizer',       { target: 'summarizer-app', description: 'Summarize the results of the benchmark' })
// validScripts.set('benchmark-helper', { target: 'cli/benchmark-helper-app', description: '' })
validScripts.set('stats',            { target: 'statistics-app', description: 'Generate statistics of used features in R code' })
validScripts.set('export-quads',     { target: 'export-quads-app', description: 'Export quads of the normalized AST of a given R code file' })

export async function waitOnScript(module: string, args: string[]): Promise<void> {
	log.info(`starting script ${module} with args ${JSON.stringify(args)}`)
	const child = cp.fork(module, args)
	child.on('exit', (code, signal) => {
		if (code) {
			console.error(`Script ${module} exited with code ${JSON.stringify(code)} and signal ${JSON.stringify(signal)}`)
			process.exit(code)
		}
	})
	await new Promise<void>(resolve => child.on('exit', resolve))
}

interface ReplProcessor {
	description: string
	script:      boolean
	fn:          (shell: RShell, tokenMap: TokenMap, remainingLine: string) => Promise<void> | void
}

const rawPrompt = 'R>'
// is a function as the 'formatter' is configured only after the cli options have been read
const prompt = () => `${formatter.format(rawPrompt, { color: Colors.cyan, effect: ColorEffect.foreground })} `

// another funny custom argument processor
const replProcessors = new Map<string, ReplProcessor>()
replProcessors.set('help', {
	description: 'Show help information',
	script:      false,
	fn:          () => {
		console.log(`
You can always just enter a R expression which gets evaluated:
${rawPrompt} ${bold('1 + 1')}
${italic('[1] 2')}

Besides that, you can use the following commands. The scripts ${italic('can')} accept further arguments. There are the following basic commands:
${
	Array.from(replProcessors.entries()).filter(([, {script}]) => !script).map(
		([command, { description }]) => `  ${bold(padCmd(':' + command))}${description}`).join('\n')			
}
Furthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add ${italic('--help')} after the command.
${
	Array.from(replProcessors.entries()).filter(([, {script}]) => script).map(
		([command, { description }]) => `  ${bold(padCmd(':' + command))}${description}`).join('\n')
}
`)
	}
})
replProcessors.set('quit', {
	description: 'End the repl',
	script:      false,
	fn:          () => { log.info('bye'); process.exit(0) }
})

for(const [script, { target, description}] of validScripts) {
	replProcessors.set(script, {
		description,
		script: true,
		fn:     async(_s, _t, remainingLine) => { await waitOnScript(`${__dirname}/${target}`, splitArguments(remainingLine)) }
	})
}


const longestKey = Array.from(replProcessors.keys(), k => k.length).reduce((p, n) => Math.max(p, n), 0)
function padCmd<T>(string: T) {
	return String(string).padEnd(longestKey + 2, ' ')
}



const replCompleterKeywords = Array.from(replProcessors.keys(), s => `:${s}`)
export function replCompleter(line: string): [string[], string] {
	return [replCompleterKeywords.filter(k => k.startsWith(line)), line]
}

/**
 * Provides a never-ending repl (read-evaluate-print loop) processor that can be used to interact with a {@link RShell} as well as all flowR scripts.
 *
 * The repl allows for two kinds of inputs:
 * - Starting with a colon `:`, indicating a command (probe `:help`, and refer to {@link replProcessors}) </li>
 * - Starting with anything else, indicating default R code to be directly executed. If you kill the underlying shell, that is on you! </li>
 *
 * @param shell     - The shell to use, if you do not pass one it will automatically create a new one with the `revive` option set to 'always'
 * @param tokenMap  - The pre-retrieved token map, if you pass none, it will be retrieved automatically (using the default {@link getStoredTokenMap}).
 * @param rl        - A potentially customized readline interface to be used for the repl to *read* from the user, we write the output with `console.log`.
 *                    If you want to provide a custom one but use the same `completer`, refer to {@link replCompleter}.
 */
export async function repl(shell = new RShell({ revive: 'always' }), tokenMap?: TokenMap, rl = readline.createInterface({
	input:                   process.stdin,
	output:                  process.stdout,
	tabSize:                 4,
	terminal:                true,
	removeHistoryDuplicates: true,
	completer:               replCompleter
})) {

	tokenMap ??= await getStoredTokenMap(shell)

	// the incredible repl :D, we kill it with ':quit'
	// eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
	while(true) {
		const answer: string = await rl.question(prompt())

		if(answer.startsWith(':')) {
			const command = answer.slice(1).split(' ')[0].toLowerCase()
			const processor = replProcessors.get(command)
			if(processor) {
				await processor.fn(shell, tokenMap, answer.slice(command.length + 2).trim())
			} else {
				// TODO: display more information?
				console.log(`the command '${command}' is unknown, try :help`)
			}
		} else {
			try {
				const result = await shell.sendCommandWithOutput(answer, {
					from:                    'both',
					automaticallyTrimOutput: true
				})
				console.log(`${italic(result.join('\n'))}\n`)
			} catch(e) {
				// TODO: deal with them
			}
		}
	}
}
