/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 * @module
 */
import { prompt } from './prompt';
import * as readline from 'readline';
import { tryExecuteRShellCommand } from './commands/repl-execute';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { splitAtEscapeSensitive } from '../../util/text/args';
import { ColorEffect, Colors, FontStyles } from '../../util/text/ansi';
import { getCommand, getCommandNames } from './commands/repl-commands';
import { getValidOptionsForCompletion, scripts } from '../common/scripts-info';
import { fileProtocol } from '../../r-bridge/retriever';
import { type ReplOutput, standardReplOutput } from './commands/repl-main';
import type { MergeableRecord } from '../../util/objects';
import { log, LogLevel } from '../../util/log';
import type { FlowrConfigOptions } from '../../config';
import { genericWrapReplFailIfNoRequest, SupportedQueries, type SupportedQuery } from '../../queries/query';
import type { FlowrAnalyzer } from '../../project/flowr-analyzer';
import { startAndEndsWith } from '../../util/text/strings';
import type { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { instrumentDataflowCount } from '../../dataflow/instrument/instrument-dataflow-count';

let _replCompleterKeywords: string[] | undefined = undefined;
function replCompleterKeywords() {
	if(_replCompleterKeywords === undefined) {
		_replCompleterKeywords = Array.from(getCommandNames(), s => `:${s}`);
	}
	return _replCompleterKeywords;
}
const defaultHistoryFile = path.join(os.tmpdir(), '.flowrhistory');

/**
 * Completion suggestions for a specific REPL command
 */
export interface CommandCompletions {
	/** The possible completions for the current argument */
	readonly completions:   string[];
	/**
	 * The current argument fragment being completed, if any.
	 * This is relevant if an argument is composed of multiple parts (e.g. comma-separated lists).
	 */
	readonly argumentPart?: string;
}

/**
 * Used by the repl to provide automatic completions for a given (partial) input line
 */
export function replCompleter(line: string, config: FlowrConfigOptions): [string[], string] {
	const splitLine = splitAtEscapeSensitive(line);
	// did we just type a space (and are starting a new arg right now)?
	const startingNewArg = line.endsWith(' ');

	// if we typed a command fully already, autocomplete the arguments
	if(splitLine.length > 1 || startingNewArg){
		const commandNameColon = replCompleterKeywords().find(k => splitLine[0] === k);
		if(commandNameColon) {
			let completions: string[] = [];
			let currentArg = startingNewArg ? '' : splitLine[splitLine.length - 1];

			const commandName = commandNameColon.slice(1);
			const cmd = getCommand(commandName);
			if(cmd?.script === true){
				// autocomplete script arguments
				const options = scripts[commandName as keyof typeof scripts].options;
				completions = completions.concat(getValidOptionsForCompletion(options, splitLine).map(o => `${o} `));
			} else if(commandName.startsWith('query')) {
				const { completions: queryCompletions, argumentPart: splitArg } = replQueryCompleter(splitLine, startingNewArg, config);
				if(splitArg !== undefined) {
					currentArg = splitArg;
				}
				completions = completions.concat(queryCompletions);
			} else {
				// autocomplete command arguments (specifically, autocomplete the file:// protocol)
				completions.push(fileProtocol);
			}

			return [completions.filter(a => a.startsWith(currentArg)), currentArg];
		}
	}

	// if no command is already typed, just return all commands that match
	return [replCompleterKeywords().filter(k => k.startsWith(line)).map(k => `${k} `), line];
}

function replQueryCompleter(splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfigOptions): CommandCompletions {
	const nonEmpty = splitLine.slice(1).map(s => s.trim()).filter(s => s.length > 0);
	const queryShorts = Object.keys(SupportedQueries).map(q => `@${q}`).concat(['help']);
	if(nonEmpty.length === 0 || (nonEmpty.length === 1 && queryShorts.some(q => q.startsWith(nonEmpty[0]) && nonEmpty[0] !== q && !startingNewArg))) {
		return { completions: queryShorts.map(q => `${q} `) };
	} else {
		const q = nonEmpty[0].slice(1);
		const queryElement = SupportedQueries[q as keyof typeof SupportedQueries] as SupportedQuery;
		if(queryElement?.completer) {
			return queryElement.completer(nonEmpty.slice(1), startingNewArg, config);
		}
	}

	return { completions: [] };
}


/**
 * Produces default readline options for the flowR REPL
 */
export function makeDefaultReplReadline(config: FlowrConfigOptions): readline.ReadLineOptions {
	return {
		input:                   process.stdin,
		output:                  process.stdout,
		tabSize:                 4,
		terminal:                true,
		history:                 loadReplHistory(defaultHistoryFile),
		removeHistoryDuplicates: true,
		completer:               (c: string) => replCompleter(c, config)
	};
}


/**
 * Handles a string input for the REPL, returning the parsed string and any remaining input.
 */
export function handleString(code: string) {
	return {
		rCode:     code.length === 0 ? undefined : startAndEndsWith(code, '"') ? JSON.parse(code) as string : code,
		remaining: []
	};
}

async function replProcessStatement(output: ReplOutput, statement: string, analyzer: FlowrAnalyzer, allowRSessionAccess: boolean): Promise<void> {
	const time = Date.now();
	const heatMap = new Map<RType, number>();
	if(analyzer.inspectContext().config.repl.dfProcessorHeat) {
		analyzer.context().config.solver.instrument.dataflowExtractors = instrumentDataflowCount(heatMap, map => map.clear());
	}
	if(statement.startsWith(':')) {
		const command = statement.slice(1).split(' ')[0].toLowerCase();
		const processor = getCommand(command);
		const bold = (s: string) => output.formatter.format(s, { style: FontStyles.Bold });
		if(processor) {
			try {
				await genericWrapReplFailIfNoRequest(async() => {
					const remainingLine = statement.slice(command.length + 2).trim();
					if(processor.isCodeCommand) {
						const args = processor.argsParser(remainingLine);
						if(args.rCode) {
							analyzer.reset();
							analyzer.addRequest(args.rCode);
						}
						await processor.fn({ output, analyzer, remainingArgs: args.remaining });
					} else {
						await processor.fn({ output, analyzer, remainingLine, allowRSessionAccess });
					}
				}, output, analyzer);
			} catch(e){
				output.stderr(`${bold(`Failed to execute command ${command}`)}: ${(e as Error)?.message}. Using the ${bold('--verbose')} flag on startup may provide additional information.\n`);
				if(log.settings.minLevel < LogLevel.Fatal) {
					console.error(e);
				}
			}
		} else {
			output.stderr(`the command '${command}' is unknown, try ${bold(':help')} for more information\n`);
		}
	} else {
		await tryExecuteRShellCommand({ output, analyzer, remainingLine: statement, allowRSessionAccess });
	}

	if(analyzer.inspectContext().config.repl.quickStats) {
		try {
			const duration = Date.now() - time;
			console.log(output.formatter.format(`[REPL Stats] Processed in ${duration}ms`, {
				style:  FontStyles.Italic,
				effect: ColorEffect.Foreground,
				color:  Colors.White
			}));
			const memoryUsage = process.memoryUsage();
			const memoryUsageStr = Object.entries(memoryUsage).map(([key, value]) => `${key}: ${(value / 1024 / 1024).toFixed(2)} MB`).join(', ');
			console.log(output.formatter.format(`[REPL Stats] Memory Usage: ${memoryUsageStr}`, {
				style:  FontStyles.Italic,
				effect: ColorEffect.Foreground,
				color:  Colors.White
			}));
		} catch{
			// do nothing, this is just a nice-to-have
		}
	}
	if(heatMap.size > 0 && analyzer.inspectContext().config.repl.dfProcessorHeat) {
		const sorted = Array.from(heatMap.entries()).sort((a, b) => b[1] - a[1]);
		console.log(output.formatter.format('[REPL Stats] Dataflow Processor Heatmap:', {
			style:  FontStyles.Italic,
			effect: ColorEffect.Foreground,
			color:  Colors.White
		}));
		const longestKey = Math.max(...Array.from(heatMap.keys(), k => k.length));
		const longestValue = Math.max(...Array.from(heatMap.values(), v => v.toString().length));
		for(const [rType, count] of sorted) {
			console.log(output.formatter.format(` - ${(rType + ':').padEnd(longestKey + 1, ' ')} ${count.toString().padStart(longestValue, ' ')}`, {
				style:  FontStyles.Italic,
				effect: ColorEffect.Foreground,
				color:  Colors.White
			}));
		}
	}

}

/**
 * This function interprets the given `expr` as a REPL command (see {@link repl} for more on the semantics).
 * @param analyzer            - The flowR analyzer to use.
 * @param output              - Defines two methods that every function in the repl uses to output its data.
 * @param expr                - The expression to process.
 * @param allowRSessionAccess - If true, allows the execution of arbitrary R code.
 */
export async function replProcessAnswer(analyzer: FlowrAnalyzer, output: ReplOutput, expr: string, allowRSessionAccess: boolean): Promise<void> {
	const statements = splitAtEscapeSensitive(expr, false, /^;\s*:/);

	for(const statement of statements) {
		await replProcessStatement(output, statement.trim(), analyzer, allowRSessionAccess);
	}
}

/**
 * Options for the {@link repl} function.
 */
export interface FlowrReplOptions extends MergeableRecord {
	/**
	 * The flowR analyzer to use.
	 */
	readonly analyzer:             FlowrAnalyzer
	/**
	 * A potentially customized readline interface to be used for the repl to *read* from the user, we write the output with the {@link ReplOutput | `output` } interface.
	 * If you want to provide a custom one but use the same `completer`, refer to {@link replCompleter}.
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
 * @param options - The options for the repl. See {@link FlowrReplOptions} for more information.
 *
 * For the execution, this function makes use of {@link replProcessAnswer}.
 */
export async function repl(
	{
		analyzer,
		rl = readline.createInterface(makeDefaultReplReadline(analyzer.flowrConfig)),
		output = standardReplOutput,
		historyFile = defaultHistoryFile,
		allowRSessionAccess = false
	}: FlowrReplOptions) {
	if(historyFile) {
		rl.on('history', h => fs.writeFileSync(historyFile, h.join('\n'), { encoding: 'utf-8' }));
	}

	// the incredible repl :D, we kill it with ':quit'

	// noinspection InfiniteLoopJS
	while(true) {
		await new Promise<void>((resolve, reject) => {
			rl.question(prompt(), answer => {
				rl.pause();
				replProcessAnswer(analyzer, output, answer, allowRSessionAccess).then(() => {
					rl.resume();
					resolve();
				}).catch(reject);
			});
		});
	}
}


/**
 * Loads the REPL history from the given file.
 */
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
