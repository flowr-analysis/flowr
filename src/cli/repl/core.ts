/**
 * Basically a helper file to allow the main 'flowr' script (located in the source root) to provide its repl
 * @module
 */
import { prompt } from './prompt';
import { handlePathLikeInput, watchProtocol } from './path-input';
import * as readline from 'readline';
import { installGhostHint } from './ghost-hint';
import { tryExecuteRShellCommand } from './commands/repl-execute';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { splitAtEscapeSensitive } from '../../util/text/args';
import { ansiFormatter, ColorEffect, Colors, FontStyles } from '../../util/text/ansi';
import { getCommand, getCommandNames } from './commands/repl-commands';
import { getValidOptionsForCompletion, scripts } from '../common/scripts-info';
import { fileProtocol } from '../../r-bridge/retriever';
import { type ReplOutput, standardReplOutput } from './commands/repl-main';
import type { MergeableRecord } from '../../util/objects';
import { log, LogLevel } from '../../util/log';
import type { FlowrConfig } from '../../config';
import { genericWrapReplFailIfNoRequest, SupportedQueries, type SupportedQuery } from '../../queries/query';
import { signatureCommand, replSignatureCompleter } from './commands/repl-signature';
import type { FlowrAnalyzer } from '../../project/flowr-analyzer';
import { startAndEndsWith, matchByPrefixOrSubsequence } from '../../util/text/strings';
import type { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { instrumentDataflowCount } from '../../dataflow/instrument/instrument-dataflow-count';
import { exitSafe } from '../../util/proc';

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
	/** What Tab displays per completion, only used while several remain: readline inserts what it displays. */
	readonly labels?:       ReadonlyMap<string, string>;
	/** Display-only suggestions (e.g. a `<string>` type placeholder): previewed as a ghost hint but never inserted on Tab. */
	readonly hints?:        readonly string[];
	/**
	 * The completer already selected these, so they must not be filtered against the typed fragment again.
	 * Needed when a completion legitimately shares no prefix with what was typed, e.g. a glob expanding to the keys it matches.
	 */
	readonly preFiltered?:  boolean;
}

/** Labels a completion with what it does, see {@link CommandCompletions#labels|labels}. */
export function describeCompletion(insert: string, describe: string): string {
	return `${insert}  ${ansiFormatter.format(describe, { style: FontStyles.Faint })}`;
}

function computeCompletions(line: string, config: FlowrConfig): [string[], string, ReadonlyMap<string, string>?, (readonly string[])?] {
	const splitLine = splitAtEscapeSensitive(line);
	// did we just type a space (and are starting a new arg right now)?
	const startingNewArg = line.endsWith(' ');

	// if we typed a command fully already, autocomplete the arguments
	if(splitLine.length > 1 || startingNewArg){
		const commandNameColon = replCompleterKeywords().find(k => splitLine[0] === k);
		if(commandNameColon) {
			let completions: string[] = [];
			let currentArg = startingNewArg ? '' : splitLine[splitLine.length - 1];
			let labels: ReadonlyMap<string, string> | undefined;
			let hints: readonly string[] | undefined;
			let preFiltered = false;

			const commandName = commandNameColon.slice(1);
			const cmd = getCommand(commandName);
			if(cmd?.script === true){
				// autocomplete script arguments
				const options = scripts[commandName as keyof typeof scripts].options;
				completions = completions.concat(getValidOptionsForCompletion(options, splitLine).map(o => `${o} `));
			} else if(commandName.startsWith('query')) {
				const { completions: queryCompletions, argumentPart: splitArg, labels: queryLabels, hints: queryHints, preFiltered: queryPreFiltered } = replQueryCompleter(splitLine, startingNewArg, config);
				if(splitArg !== undefined) {
					currentArg = splitArg;
				}
				completions = completions.concat(queryCompletions);
				labels = queryLabels;
				hints = queryHints;
				preFiltered = queryPreFiltered ?? false;
			} else if(cmd === signatureCommand) {
				const { completions: sigCompletions, argumentPart: splitArg } = replSignatureCompleter(splitLine, startingNewArg);
				if(splitArg !== undefined) {
					currentArg = splitArg;
				}
				completions = completions.concat(sigCompletions);
			} else if(cmd?.isCodeCommand) {
				completions.push(fileProtocol);
				completions.push(watchProtocol);
			}

			// prefix matches when any exist, else fuzzy (subsequence) matches, so e.g. `+sg` still completes to `+specializeConfig`
			return [preFiltered ? completions : matchByPrefixOrSubsequence(completions, currentArg), currentArg, labels, hints?.filter(h => h.startsWith(currentArg))];
		}
	}

	// if no command is already typed, just return all commands that match
	return [replCompleterKeywords().filter(k => k.startsWith(line)).map(k => `${k} `), line];
}

/**
 * Used by the repl to provide automatic completions for a given (partial) input line. Returns every matching
 * option, so Tab shows the full menu and only completes when a single option remains (standard readline behavior).
 */
export function replCompleter(line: string, config: FlowrConfig): [string[], string] {
	const [completions, fragment, labels] = computeCompletions(line, config);
	if(labels === undefined || completions.length <= 1) {
		return [completions, fragment];
	}
	return [completions.map(c => labels.get(c) ?? c), fragment];
}

/**
 * The remaining text of the best (first) completion, i.e. what the inline ghost previews as you type; empty when
 * there is nothing to suggest. Independent of {@link replCompleter}: the ghost hints the best match even when Tab
 * would still offer several.
 */
export function completionSuggestion(line: string, config: FlowrConfig): string {
	if(line.length === 0) {
		return '';
	}
	const [completions, fragment, , hints] = computeCompletions(line, config);
	// prefer an insertable completion; otherwise preview a display-only hint (e.g. a `<string>` type placeholder)
	const best = completions[0] ?? hints?.[0];
	if(best === undefined || !best.startsWith(fragment) || best.length <= fragment.length) {
		return '';
	} else if(best === fileProtocol || best === watchProtocol) {
		return '';
	}
	return best.slice(fragment.length);
}

function replQueryCompleter(splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfig): CommandCompletions {
	const nonEmpty = splitLine.slice(1).map(s => s.trim()).filter(s => s.length > 0);
	const queryShorts = ['help'].concat(Object.keys(SupportedQueries).map(q => `@${q}`));
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
export function makeDefaultReplReadline(config: FlowrConfig, historyFile: string | undefined = defaultHistoryFile): readline.ReadLineOptions {
	return {
		input:                   process.stdin,
		output:                  process.stdout,
		tabSize:                 4,
		terminal:                true,
		history:                 historyFile ? loadReplHistory(historyFile) : [],
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

/** Convert a statement containing {@link watchProtocol} into one using {@link fileProtocol} so it can be executed. */
export function toFileStatement(statement: string): string {
	return statement.replaceAll(watchProtocol, fileProtocol);
}

/** Return the watch path from the first `watch://<path>` token in `statement`, or `undefined` if none is present. */
export function extractWatchPath(statement: string): string | undefined {
	return /watch:\/\/(\S+)/.exec(statement)?.[1];
}

let activeWatcher: fs.FSWatcher | undefined;

/** Stop the active watcher. Pass `notify = false` when silently switching to a new watch target. */
export function stopWatching(output: ReplOutput, notify = true): void {
	if(activeWatcher !== undefined) {
		try {
			activeWatcher.close();
		} catch{ /* already closed */ }
		activeWatcher = undefined;
		if(notify) {
			output.stdout('Watch mode stopped.');
		}
	}
}

/** `watchImpl` is injectable so tests can pass a fake `fs.watch`. */
export function startWatching(
	watchPath: string,
	output: ReplOutput,
	onFire: () => void,
	watchImpl: typeof fs.watch = fs.watch
): fs.FSWatcher {
	const faint = (s: string) => output.formatter.format(s, { style: FontStyles.Faint });
	const isDir = fs.existsSync(watchPath) && fs.statSync(watchPath).isDirectory();
	let debounce: ReturnType<typeof setTimeout> | undefined;
	const watcher = watchImpl(watchPath, { recursive: isDir }, () => {
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			output.stdout(faint(`\nChange detected in '${watchPath}', re-running...`));
			onFire();
		}, 50);
	});
	output.stdout(faint(`Watching ${isDir ? 'folder' : 'file'} '${watchPath}'. Press Ctrl+C or enter another command to stop.`));
	return watcher;
}

async function executeStatement(output: ReplOutput, statement: string, analyzer: FlowrAnalyzer, allowRSessionAccess: boolean): Promise<void> {
	const time = Date.now();
	const heatMap = new Map<RType, number>();
	if(analyzer.inspectContext().config.repl.dfProcessorHeat) {
		analyzer.context().config.solver.instrument.dataflowExtractors = instrumentDataflowCount(heatMap, map => map.clear());
	}
	if(statement.startsWith(':')) {
		const command = statement.slice(1).split(' ')[0].toLowerCase();
		const bold = (s: string) => output.formatter.format(s, { style: FontStyles.Bold });
		const reportFailure = (e: unknown) => {
			output.stderr(`${bold(`Failed to execute command ${command}`)}: ${(e as Error)?.message}. Using the ${bold('--verbose')} flag on startup may provide additional information.\n`);
			if(log.settings.minLevel < LogLevel.Fatal) {
				console.error(e);
			}
		};
		try {
			const processor = getCommand(command);
			if(processor) {
				await genericWrapReplFailIfNoRequest(async() => {
					const remainingLine = statement.slice(command.length + 2).trim();
					if(processor.isCodeCommand) {
						const args = processor.argsParser(remainingLine);
						if(args.rCode) {
							const rawPath = args.rCode.startsWith(fileProtocol)
								? args.rCode.substring(fileProtocol.length)
								: undefined;
							const alreadyKnown = rawPath !== undefined
								&& analyzer.context().files.getFileByPath(rawPath) !== undefined;
							if(!alreadyKnown) {
								analyzer.reset();
								analyzer.addRequest(handlePathLikeInput(output, args.rCode, analyzer.flowrConfig));
							}
						}
						await processor.fn({ output, analyzer, remainingArgs: args.remaining });
					} else {
						await processor.fn({ output, analyzer, remainingLine, allowRSessionAccess });
					}
				}, output, analyzer);
			} else {
				output.stderr(`the command '${command}' is unknown, try ${bold(':help')} for more information\n`);
			}
		} catch(e){
			reportFailure(e);
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

async function replProcessStatement(output: ReplOutput, statement: string, analyzer: FlowrAnalyzer, allowRSessionAccess: boolean): Promise<void> {
	stopWatching(output, !statement.includes(watchProtocol));

	if(statement.includes(watchProtocol)) {
		const watchPath = extractWatchPath(statement);
		const effective = toFileStatement(statement);
		await executeStatement(output, effective, analyzer, allowRSessionAccess);
		if(watchPath) {
			try {
				activeWatcher = startWatching(watchPath, output, () => {
					analyzer.context().files.getFileByPath(watchPath)?.invalidate();
					void executeStatement(output, effective, analyzer, allowRSessionAccess);
				});
				activeWatcher.unref();
				activeWatcher.on('error', (err: Error) => {
					output.stderr(`Watch error for '${watchPath}': ${err.message}`);
					stopWatching(output, false);
				});
			} catch(e) {
				output.stderr(`Cannot watch '${watchPath}': ${(e as Error).message}`);
			}
		}
		return;
	}

	await executeStatement(output, statement, analyzer, allowRSessionAccess);
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
	/** The file to use for loading and persisting the repl's history. Passing an empty string neither reads nor writes it. */
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
		historyFile = defaultHistoryFile,
		rl = readline.createInterface(makeDefaultReplReadline(analyzer.flowrConfig, historyFile)),
		output = standardReplOutput,
		allowRSessionAccess = false
	}: FlowrReplOptions) {
	if(historyFile) {
		rl.on('history', h => fs.writeFileSync(historyFile, h.join('\n'), { encoding: 'utf-8' }));
	}

	const ghostHint = installGhostHint(rl, analyzer.flowrConfig, {
		suggest: line => completionSuggestion(line, analyzer.flowrConfig)
	});

	let sigintCount = 0;
	rl.on('SIGINT', () => {
		process.stdout.write('\n');
		if(activeWatcher !== undefined) {
			stopWatching(output);
			rl.setPrompt(prompt());
			sigintCount = 0;
		} else {
			sigintCount++;
			if(sigintCount >= 2) {
				stopWatching(output, false);
				exitSafe(0);
			} else {
				output.stdout('(Press Ctrl+C again or type :quit to exit)');
				setTimeout(() => {
					sigintCount = 0;
				}, 2000).unref();
			}
		}
		rl.prompt();
	});

	rl.on('close', () => {
		stopWatching(output, false);
		exitSafe(0);
	});

	// the incredible repl :D, we kill it with ':quit'

	// noinspection InfiniteLoopJS
	while(true) {
		await new Promise<void>((resolve, reject) => {
			rl.question(activeWatcher !== undefined ? '' : prompt(), answer => {
				ghostHint.clear();
				sigintCount = 0;
				rl.pause();
				replProcessAnswer(analyzer, output, answer, allowRSessionAccess).then(() => {
					rl.resume();
					resolve();
				}).catch(reject);
			});
			if(activeWatcher === undefined) {
				ghostHint.show();
			}
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
