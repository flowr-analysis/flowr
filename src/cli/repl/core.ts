/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 *
 * @module
 */
import { prompt } from './prompt';
import * as readline from 'readline';
import { tryExecuteRShellCommand } from './commands/repl-execute';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { splitAtEscapeSensitive } from '../../util/text/args';
import { FontStyles } from '../../util/text/ansi';
import { getCommand, getCommandNames } from './commands/repl-commands';
import { getValidOptionsForCompletion, scripts } from '../common/scripts-info';
import { fileProtocol, requestFromInput } from '../../r-bridge/retriever';
import type { ReplOutput } from './commands/repl-main';
import { standardReplOutput } from './commands/repl-main';
import { RShell, RShellReviveOptions } from '../../r-bridge/shell';
import type { MergeableRecord } from '../../util/objects';
import type { KnownParser } from '../../r-bridge/parser';
import { log, LogLevel } from '../../util/log';
import type { FlowrConfigOptions } from '../../config';
import { getEngineConfig } from '../../config';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';

let _replCompleterKeywords: string[] | undefined = undefined;
function replCompleterKeywords() {
	if(_replCompleterKeywords === undefined) {
		_replCompleterKeywords = Array.from(getCommandNames(), s => `:${s}`);
	}
	return _replCompleterKeywords;
}
const defaultHistoryFile = path.join(os.tmpdir(), '.flowrhistory');

/**
 * Used by the repl to provide automatic completions for a given (partial) input line
 */
export function replCompleter(line: string): [string[], string] {
	const splitLine = splitAtEscapeSensitive(line);
	// did we just type a space (and are starting a new arg right now)?
	const startingNewArg = line.endsWith(' ');

	// if we typed a command fully already, autocomplete the arguments
	if(splitLine.length > 1 || startingNewArg){
		const commandNameColon = replCompleterKeywords().find(k => splitLine[0] === k);
		if(commandNameColon) {
			const completions: string[] = [];

			const commandName = commandNameColon.slice(1);
			if(getCommand(commandName)?.script === true){
				// autocomplete script arguments
				const options = scripts[commandName as keyof typeof scripts].options;
				completions.push(...getValidOptionsForCompletion(options, splitLine).map(o => `${o} `));
			} else {
				// autocomplete command arguments (specifically, autocomplete the file:// protocol)
				completions.push(fileProtocol);
			}

			// add an empty option so that it doesn't autocomplete the only defined option immediately
			completions.push(' ');

			const currentArg = startingNewArg ? '' : splitLine[splitLine.length - 1];
			return [completions.filter(a => a.startsWith(currentArg)), currentArg];
		}
	}

	// if no command is already typed, just return all commands that match
	return [replCompleterKeywords().filter(k => k.startsWith(line)).map(k => `${k} `), line];
}

export function makeDefaultReplReadline(): readline.ReadLineOptions {
	return {
		input:                   process.stdin,
		output:                  process.stdout,
		tabSize:                 4,
		terminal:                true,
		history:                 loadReplHistory(defaultHistoryFile),
		removeHistoryDuplicates: true,
		completer:               replCompleter
	};
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

async function replProcessStatement(output: ReplOutput, statement: string, parser: KnownParser, allowRSessionAccess: boolean, config: FlowrConfigOptions): Promise<void> {
	if(statement.startsWith(':')) {
		const command = statement.slice(1).split(' ')[0].toLowerCase();
		const processor = getCommand(command);
		const bold = (s: string) => output.formatter.format(s, { style: FontStyles.Bold });
		if(processor) {
			try {
				const remainingLine = statement.slice(command.length + 2).trim();
				if(processor.usesAnalyzer) {
					const request = requestFromInput(handleString(remainingLine));
					// TODO TSchoeller engine/parser
					// TODO TSchoeller Ideally the analyzer would also be used for query commands
					// TODO TSchoeller Is this the right level to create the analyzer instance?
					const analyzer = await new FlowrAnalyzerBuilder(request)
						.setConfig(config)
						.setParser(parser)
						.build();
					await processor.fn({ output, analyzer });
				} else {
					await processor.fn({ output, parser, remainingLine, allowRSessionAccess, config });
				}
			} catch(e){
				output.stdout(`${bold(`Failed to execute command ${command}`)}: ${(e as Error)?.message}. Using the ${bold('--verbose')} flag on startup may provide additional information.\n`);
				if(log.settings.minLevel < LogLevel.Fatal) {
					console.error(e);
				}
			}
		} else {
			output.stdout(`the command '${command}' is unknown, try ${bold(':help')} for more information\n`);
		}
	} else {
		await tryExecuteRShellCommand({ output, parser, remainingLine: statement, allowRSessionAccess, config });
	}
}

/**
 * This function interprets the given `expr` as a REPL command (see {@link repl} for more on the semantics).
 *
 * @param config              - flowr Config
 * @param output              - Defines two methods that every function in the repl uses to output its data.
 * @param expr                - The expression to process.
 * @param parser               - The {@link RShell} or {@link TreeSitterExecutor} to use (see {@link repl}).
 * @param allowRSessionAccess - If true, allows the execution of arbitrary R code.
 */
export async function replProcessAnswer(config: FlowrConfigOptions, output: ReplOutput, expr: string, parser: KnownParser, allowRSessionAccess: boolean): Promise<void> {

	const statements = splitAtEscapeSensitive(expr, false, ';');

	for(const statement of statements) {
		await replProcessStatement(output, statement, parser, allowRSessionAccess, config);
	}
}

/**
 * Options for the {@link repl} function.
 */
export interface FlowrReplOptions extends MergeableRecord {
	/** The shell to use, if you do not pass one it will automatically create a new one with the `revive` option set to 'always'. */
	readonly parser?:              KnownParser
	/**
	 * A potentially customized readline interface to be used for the repl to *read* from the user, we write the output with the {@link ReplOutput | `output` } interface.
    * If you want to provide a custom one but use the same `completer`, refer to {@link replCompleter}.
    * For the default arguments, see {@link DEFAULT_REPL_READLINE_CONFIGURATION}.
	 */
	readonly rl?:                  readline.Interface
	/** Defines two methods that every function in the repl uses to output its data. */
	readonly output?:              ReplOutput
	/** The file to use for persisting the repl's history. Passing undefined causes history not to be saved. */
	readonly historyFile?:         string
	/** If true, allows the execution of arbitrary R code. This is a security risk, as it allows the execution of arbitrary R code. */
	readonly allowRSessionAccess?: boolean
}

/**
 * Provides a never-ending repl (read-evaluate-print loop) processor that can be used to interact with a {@link RShell} as well as all flowR scripts.
 *
 * The repl allows for two kinds of inputs:
 * - Starting with a colon `:`, indicating a command (probe `:help`, and refer to {@link commands}) </li>
 * - Starting with anything else, indicating default R code to be directly executed. If you kill the underlying shell, that is on you! </li>
 *
 * @param options - The options for the repl. See {@link FlowrReplOptions} for more information.
 * @param config  - The flowr config
 *
 * For the execution, this function makes use of {@link replProcessAnswer}.
 *
 */
export async function repl(
	config: FlowrConfigOptions,
	{
		parser = new RShell(getEngineConfig(config, 'r-shell'), { revive: RShellReviveOptions.Always }),
		rl = readline.createInterface(makeDefaultReplReadline()),
		output = standardReplOutput,
		historyFile = defaultHistoryFile,
		allowRSessionAccess = false
	}: FlowrReplOptions) {
	if(historyFile) {
		rl.on('history', h => fs.writeFileSync(historyFile, h.join('\n'), { encoding: 'utf-8' }));
	}

	// the incredible repl :D, we kill it with ':quit'
	 
	while(true) {
		await new Promise<void>((resolve, reject) => {
			rl.question(prompt(), answer => {
				rl.pause();
				replProcessAnswer(config, output, answer, parser, allowRSessionAccess).then(() => {
					rl.resume();
					resolve();
				}).catch(reject);
			});
		});
	}
}

export function loadReplHistory(historyFile: string): string[] | undefined {
	try {
		if(!fs.existsSync(historyFile)) {
			return undefined;
		}
		return fs.readFileSync(historyFile, { encoding: 'utf-8' }).split('\n');
	} catch(e) {
		log.error(`Failed to load repl history from ${historyFile}: ${(e as Error)?.message}`);
		log.error((e as Error)?.stack);
		return undefined;
	}
}
