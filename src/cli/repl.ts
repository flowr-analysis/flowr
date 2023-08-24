/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 *
 * @module
 */
import { getStoredTokenMap, RShell, TokenMap } from '../r-bridge'
import readline from 'readline/promises'
import { ColorEffect, Colors, formatter } from '../statistics'

interface ReplProcessor {
	description: string
	fn:          (shell: RShell, tokenMap: TokenMap) => Promise<void> | void
}

// another funny custom argument processor
const replProcessors = new Map<string, ReplProcessor>()
replProcessors.set('help', {
	description: 'x',
	fn:          () => { console.log('x') }
})
replProcessors.set('quit', {
	description: 'quit the repl',
	fn:          () => { process.exit(0) }
})


// TODO: completer

/**
 * Provides a never-ending repl (read-evaluate-print loop) processor that can be used to interact with a {@link RShell} as well as all flowR scripts.
 *
 * The repl allows for two kinds of inputs:
 * - Starting with a colon `:`, indicating a command (probe `:help`, and refer to {@link replProcessors}) </li>
 * - Starting with anything else, indicating default R code to be directly executed. If you kill the underlying shell, that is on you! </li>
 *
 * @param shell     - The shell to use
 * @param tokenMap  - The pre-retrieved token map, if you pass none, it will be retrieved automatically (using the default {@link getStoredTokenMap}).
 * @param rl        - A potentially customized readline interface to be used for the repl to *read* from the user, we always write to stdout.
 */
export async function repl(shell: RShell, tokenMap?: TokenMap, rl = readline.createInterface({
	input:                   process.stdin,
	tabSize:                 4,
	removeHistoryDuplicates: true
})) {

	tokenMap ??= await getStoredTokenMap(shell)

	const prompt = `${formatter.format('R>', { color: Colors.cyan, effect: ColorEffect.foreground })} `

	// the incredible repl :D, we kill it with ':quit'
	// eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
	while(true) {
		const answer: string = await rl.question(prompt)

		if(answer.startsWith(':')) {
			const command = answer.slice(1).split(' ')[0].toLowerCase()
			const processor = replProcessors.get(command)
			if(processor) {
				await processor.fn(shell, tokenMap)
			} else {
				// TODO: display more information?
				console.log(`the command '${command}' is unknown, try :help`)
			}
		} else {
			try {
				const result = await shell.sendCommandWithOutput(answer)
				console.log(`${result.join('\n')}\n`)
			} catch(e) {
				// TODO: deal with them
			}
		}
	}
}
