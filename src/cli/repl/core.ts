/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 *
 * @module
 */
import { RShell } from '../../r-bridge'
import { bold } from '../../statistics'
import { prompt } from './prompt'
import type { ReplOutput} from './commands'
import { commandNames, getCommand, standardReplOutput } from './commands'
import * as readline from 'node:readline'
import { splitAtEscapeSensitive } from '../../util/args'
import { executeRShellCommand } from './commands/execute'
import { guard } from '../../util/assert'
import { getScriptInformation} from '../common/scripts-info'
import type { OptionDefinition } from 'command-line-usage'

const replCompleterKeywords = Array.from(commandNames, s => `:${s}`)

/**
 * Used by the repl to provide automatic completions for a given (partial) input line
 */
export function replCompleter(line: string): [string[], string] {
	const splitCommandList = splitAtEscapeSensitive(line)
	//console.log(splitCommandList)
	//find command in commandlist
	const keyword = replCompleterKeywords.find(k => splitCommandList[0] === k)
	if(keyword !== undefined && keyword.startsWith(':')){
		const singleCommand = getCommand(keyword.slice(1))
		guard(singleCommand !== undefined, 'Keyword does not match any command')
		if(singleCommand.script){
			const scriptInformation = getScriptInformation(keyword.slice(1))
			guard(scriptInformation !== undefined, 'script should be in script record')
			const scriptOptions: OptionDefinition[] = scriptInformation.options
			//console.log(scriptOptions)//TODO REMOVE
			const possibleOptions :OptionDefinition[] = getPossibleCommandLineOptions(scriptOptions, splitCommandList)
			const possibleCliOptionsAsString : string[] = extractCliStringsFromCommandOptions(possibleOptions)
			//console.log(possibleOptions)//TODO REMOVE
			//Only command was specified
			if(splitCommandList.length < 2){
				//console.log(possibleOptions)//TODO REMOVE
				possibleCliOptionsAsString.push(line)
				return [possibleCliOptionsAsString, line]
			}

			const lastOptionInProgress = splitCommandList.at(-1)
			guard(lastOptionInProgress !== undefined, 'splitCommandList cannot be of lenth 0')
			console.log(lastOptionInProgress) //TODO REMOVE
			//console.log(possibleOptions) //TODO REMOVE
			const matchingOptionsLeft = possibleCliOptionsAsString.filter(o => o.startsWith(lastOptionInProgress))
			if(matchingOptionsLeft.length === 1){
				const commandWithoutLastEntry = splitCommandList.slice(0, -1).join(' ')
				return [[commandWithoutLastEntry + ' ' + matchingOptionsLeft[0]], line]
			}
			matchingOptionsLeft.push(line)
			return [matchingOptionsLeft, line]
		}
	}
	return [replCompleterKeywords.filter(k => k.startsWith(line)), line]
}

export function extractCliStringsFromCommandOptions(options: OptionDefinition[]):string[]{
	const extractedCliStrings:string[] = []
	options.forEach(o => {
		extractedCliStrings.push('--' + o.name)
		if(o.alias !== undefined){
			extractedCliStrings.push('-' + o.alias)
		}
	})
	return extractedCliStrings
}

function getPossibleCommandLineOptions(scriptOptions: OptionDefinition[], splitCommandList: string[]): OptionDefinition[] {
	const optionUsed: Map<string, boolean> = new Map <string, boolean>()
	scriptOptions.forEach(o => optionUsed.set(o.name, false))
	for(let commandLineOptionIndex = 1; commandLineOptionIndex < splitCommandList.length; commandLineOptionIndex++){
		if(splitCommandList[commandLineOptionIndex].substring(0,1) !== '-'){
			continue
		}
		let cliOptionWithOutLeadingMinus: string = splitCommandList[commandLineOptionIndex].slice(1)
		if(cliOptionWithOutLeadingMinus.substring(0,1) !== '-'){
			const option = scriptOptions.find(o => o.alias === cliOptionWithOutLeadingMinus)
			//console.log(option) //TODO Remove
			if(option !== undefined){
				optionUsed.set(option.name, true)
			} else {
				continue
			}
		}

		cliOptionWithOutLeadingMinus = cliOptionWithOutLeadingMinus.slice(1)
		if(cliOptionWithOutLeadingMinus.substring(0,1) !== '-'){
			if(optionUsed.has(cliOptionWithOutLeadingMinus)){
				optionUsed.set(cliOptionWithOutLeadingMinus, true)
			}
		}
	}
	const possibleOptions : OptionDefinition[] = []
	optionUsed.forEach((usedValue, optionName) => {
		const newOption = scriptOptions.find(o => o.name === optionName)
		guard(newOption !== undefined, 'Option contained must be in original Options list')	
		if(usedValue){
			if(newOption.multiple !== undefined && newOption.multiple){
				possibleOptions.push(newOption)
			}
		} else {
			possibleOptions.push(newOption)
		}
	})
	//console.log(optionUsed) //TODO Remove
	return possibleOptions
}

export const DEFAULT_REPL_READLINE_CONFIGURATION: readline.ReadLineOptions = {
	input:                   process.stdin,
	output:                  process.stdout,
	tabSize:                 4,
	terminal:                true,
	removeHistoryDuplicates: true,
	completer:               replCompleter
}

async function replProcessStatement(output: ReplOutput, statement: string, shell: RShell) {
	if(statement.startsWith(':')) {
		const command = statement.slice(1).split(' ')[0].toLowerCase()
		const processor = getCommand(command)
		if(processor) {
			await processor.fn(output, shell, statement.slice(command.length + 2).trim())
		} else {
			console.log(`the command '${command}' is unknown, try ${bold(':help')} for more information`)
		}
	} else {
		await executeRShellCommand(output, shell, statement)
	}
}

/**
 * This function interprets the given `expr` as a REPL command (see {@link repl} for more on the semantics).
 *
 * @param output   - Defines two methods that every function in the repl uses to output its data.
 * @param expr     - The expression to process.
 * @param shell    - The {@link RShell} to use (see {@link repl}).
 */
export async function replProcessAnswer(output: ReplOutput, expr: string, shell: RShell): Promise<void> {

	const statements = splitAtEscapeSensitive(expr, ';')

	for(const statement of statements) {
		await replProcessStatement(output, statement, shell)
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
 * @param rl        - A potentially customized readline interface to be used for the repl to *read* from the user, we write the output with the {@link ReplOutput | `output` } interface.
 *                    If you want to provide a custom one but use the same `completer`, refer to {@link replCompleter}.
 *                    For the default arguments, see {@link DEFAULT_REPL_READLINE_CONFIGURATION}.
 * @param output    - Defines two methods that every function in the repl uses to output its data.
 *
 * For the execution, this function makes use of {@link replProcessAnswer}
 *
 */
export async function repl(shell = new RShell({ revive: 'always' }), rl = readline.createInterface(DEFAULT_REPL_READLINE_CONFIGURATION), output = standardReplOutput) {

	// the incredible repl :D, we kill it with ':quit'
	// eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
	while(true) {
		await new Promise<void>((resolve, reject) => {
			rl.question(prompt(), answer => {
				rl.pause()
				replProcessAnswer(output, answer, shell).then(() => {
					rl.resume()
					resolve()
				}).catch(reject)
			})
		})
	}
}
