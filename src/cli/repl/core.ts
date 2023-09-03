/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 *
 * @module
 */
import { getStoredTokenMap, RShell, TokenMap } from '../../r-bridge'
import readline from 'readline/promises'
import { bold } from '../../statistics'
import { prompt } from './prompt'
import { commandNames, getCommand, ReplOutput, standardReplOutput } from './commands'
import { ReadLineOptions } from 'node:readline'
import { splitAtEscapeSensitive } from '../../util/args'
import { executeRShellCommand } from './commands/execute'
import { MergeableRecord } from '../../util/objects'

const replCompleterKeywords = Array.from(commandNames, s => `:${s}`)

/**
 * Used by the repl to provide automatic completions for a given (partial) input line
 */
export function replCompleter(line: string): [string[], string] {
	return [replCompleterKeywords.filter(k => k.startsWith(line)), line]
}

export const DEFAULT_REPL_READLINE_CONFIGURATION: ReadLineOptions = {
	input:                   process.stdin,
	output:                  process.stdout,
	tabSize:                 4,
	terminal:                true,
	removeHistoryDuplicates: true,
	completer:               replCompleter
}

async function replProcessStatement(output: ReplOutput, statement: string, shell: RShell, tokenMap: TokenMap) {
	if(statement.startsWith(':')) {
		const command = statement.slice(1).split(' ')[0].toLowerCase()
		const processor = getCommand(command)
		if(processor) {
			await processor.fn(output, shell, tokenMap, statement.slice(command.length + 2).trim())
		} else {
			console.log(`the command '${command}' is unknown, try ${bold(':help')} for more information`)
		}
	} else {
		await executeRShellCommand(output, shell, statement)
	}
}

export async function replProcessAnswer(output: ReplOutput, answer: string, shell: RShell, tokenMap: TokenMap): Promise<void> {

	const statements = splitAtEscapeSensitive(answer, ';')

	for(const statement of statements) {
		await replProcessStatement(output, statement, shell, tokenMap)
	}
}

/**
 * Provides a never-ending repl (read-evaluate-print loop) processor that can be used to interact with a {@link RShell} as well as all flowR scripts.
 *
 * The repl allows for two kinds of inputs:
 * - Starting with a colon `:`, indicating a command (probe `:help`, and refer to {@link commands}) </li>
 * - Starting with anything else, indicating default R code to be directly executed. If you kill the underlying shell, that is on you! </li>
 *
 * @param shell     - The shell to use, if you do not pass one it will automatically create a new one with the `revive` option set to 'always'
 * @param tokenMap  - The pre-retrieved token map, if you pass none, it will be retrieved automatically (using the default {@link getStoredTokenMap}).
 * @param rl        - A potentially customized readline interface to be used for the repl to *read* from the user, we write the output with the {@link ReplOutput | `output` } interface.
 *                    If you want to provide a custom one but use the same `completer`, refer to {@link replCompleter}.
 *                    For the default arguments, see {@link DEFAULT_REPL_READLINE_CONFIGURATION}.
 * @param output    - Defines two methods that every function in the repl uses to output its data.
 *
 */
export async function repl(shell = new RShell({ revive: 'always' }), tokenMap?: TokenMap, rl = readline.createInterface(DEFAULT_REPL_READLINE_CONFIGURATION), output = standardReplOutput) {

	tokenMap ??= await getStoredTokenMap(shell)

	// the incredible repl :D, we kill it with ':quit'
	// eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
	while(true) {
		const answer: string = await rl.question(prompt())

		await replProcessAnswer(output, answer, shell, tokenMap)
	}
}
