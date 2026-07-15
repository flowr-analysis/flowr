import { quitCommand } from './repl-quit';
import { stdioCaptureProcessor, waitOnScript } from '../execute';
import type { ReplBaseCommand, ReplCodeCommand, ReplCommand } from './repl-main';
import { rawPrompt } from '../prompt';
import { versionCommand } from './repl-version';
import { parseCommand } from './repl-parse';
import { executeCommand } from './repl-execute';
import { normalizeCommand, normalizeHashCommand, normalizeStarCommand } from './repl-normalize';
import {
	dataflowAsciiCommand,
	dataflowCommand, dataflowSilentCommand,
	dataflowSimpleStarCommand,
	dataflowSimplifiedCommand,
	dataflowStarCommand
} from './repl-dataflow';
import { controlflowBbCommand, controlflowBbStarCommand, controlflowCommand, controlflowStarCommand } from './repl-cfg';
import { type OutputFormatter, Colors, FontStyles, bold, color, italic } from '../../../util/text/ansi';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { guard } from '../../../util/assert';
import { scripts } from '../../common/scripts-info';
import { queryCommand, queryStarCommand } from './repl-query';
import { signatureCommand } from './repl-signature';
import { flowrVersion } from '../../../util/version';

const cmd = (name: string, f: OutputFormatter): string => color(name, Colors.Cyan, f, { style: FontStyles.Bold });

const ansiSgr = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const visibleLength = (s: string): number => s.replace(ansiSgr, '').length;

/** Appends `content` after `prefix`, word-wrapping to the terminal width with a hanging indent. */
function wrapAfter(prefix: string, content: string): string {
	const width = process.stdout.isTTY ? (process.stdout.columns ?? 80) : Infinity;
	const indent = visibleLength(prefix);
	const pad = ' '.repeat(indent);
	const lines: string[] = [];
	let line = '';
	let lineLength = indent;
	for(const word of content.split(' ')) {
		const wordLength = visibleLength(word);
		if(line !== '' && lineLength + 1 + wordLength > width) {
			lines.push(line);
			line = word;
			lineLength = indent + wordLength;
		} else {
			line = line === '' ? word : `${line} ${word}`;
			lineLength = line === word ? indent + wordLength : lineLength + 1 + wordLength;
		}
	}
	if(line !== '') {
		lines.push(line);
	}
	return prefix + lines.map((l, i) => i === 0 ? l : pad + l).join('\n');
}

function printHelpForScript(script: [string, ReplBaseCommand], f: OutputFormatter, starredVersion?: ReplBaseCommand): string {
	let content = script[1].description;
	if(starredVersion) {
		content += ` ${italic(`(star: ${starredVersion.description})`, f)}`;
	}
	const aliases = script[1].aliases;
	if(aliases.length > 0) {
		content += ` ${italic(`(alias${aliases.length > 1 ? 'es' : ''}:`, f)} ${aliases.map(a => cmd(':' + a, f)).join(', ')}${italic(')', f)}`;
	}
	return wrapAfter(`  ${cmd(padCmd(':' + script[0] + (starredVersion ? '[*]' : '')), f)}`, content);
}

function printFamilyVariants(children: string[], cmds: Record<string, ReplCommand | ReplCodeCommand>, f: OutputFormatter): string {
	const variant = (name: string) => {
		const aliases = cmds[name].aliases;
		const suffix = aliases.length > 0 ? ' ' + italic(`(${aliases.map(a => ':' + a).join(', ')})`, f) : '';
		return cmd(':' + name + (cmds[name + '*'] ? '[*]' : ''), f) + suffix;
	};
	return wrapAfter(`     ${italic('variants:', f)} `, children.map(variant).join(', '));
}

function printCommandHelp(formatter: OutputFormatter) {
	const cmds = getReplCommands();
	const bases = Object.entries(cmds).filter(([name, c]) => !c.script && !name.endsWith('*'));
	const names = bases.map(([name]) => name);
	const shortestPrefixCommand = (name: string) => names.filter(n => name.startsWith(n)).reduce((a, b) => a.length <= b.length ? a : b);

	const children = new Map<string, string[]>();
	for(const name of names) {
		const root = shortestPrefixCommand(name);
		if(root !== name) {
			children.set(root, [...children.get(root) ?? [], name]);
		}
	}

	const lines: string[] = [];
	for(const entry of bases.filter(([name]) => shortestPrefixCommand(name) === name).sort((a, b) => a[0].localeCompare(b[0]))) {
		lines.push(printHelpForScript(entry, formatter, cmds[entry[0] + '*']));
		const variants = children.get(entry[0]);
		if(variants) {
			lines.push(printFamilyVariants(variants.sort(), cmds, formatter));
		}
	}
	return lines.join('\n');
}

export const helpCommand: ReplCommand = {
	description:   'Show help information',
	isCodeCommand: false,
	script:        false,
	usageExample:  ':help',
	aliases:       [ 'h', '?' ],
	fn:            ({ output }) => {
		initCommandMapping();
		output.stdout(`
If enabled ('--r-session-access' and if using the 'r-shell' engine), you can just enter R expressions which get evaluated right away:
${rawPrompt} ${bold('1 + 1', output.formatter)}
${italic('[1] 2', output.formatter)}

Besides that, you can use the following commands. The scripts ${italic('can', output.formatter)} accept further arguments. In general, those ending with [*] may be called with and without the star. 
There are the following basic commands:
${
	printCommandHelp(output.formatter)
}

Furthermore, you can directly call the following scripts which accept arguments. If you are unsure, try to add ${italic('--help', output.formatter)} after the command.
${
	Array.from(Object.entries(getReplCommands())).filter(([, { script }]) => script).map(
		([command, { description }]) => wrapAfter(`  ${cmd(padCmd(':' + command), output.formatter)}`, description)).sort().join('\n')
}

You can combine commands by separating them with a semicolon ${bold(';', output.formatter)}.

Commands that accept a file path support two path prefixes:
  ${color('file://<path>', Colors.Green, output.formatter, { style: FontStyles.Bold })}   run the command once on the given file or folder
  ${color('watch://<path>', Colors.Yellow, output.formatter, { style: FontStyles.Bold })}  re-run the command whenever the file (or any file in the folder) changes
                     Press Ctrl+C or enter any other command to leave watch mode.

You are running flowR ${bold('v' + flowrVersion().toString(), output.formatter)} (use ${bold(':version', output.formatter)} for details). Check for newer releases and per-install upgrade steps (Docker, npm, source) at:
  ${color('https://github.com/flowr-analysis/flowr/releases', Colors.Cyan, output.formatter, { style: FontStyles.Bold })}
`);
	}
};

/**
 * All commands that should be available in the REPL.
 */
const _commands = {
	'help':            helpCommand,
	'quit':            quitCommand,
	'version':         versionCommand,
	'execute':         executeCommand,
	'parse':           parseCommand,
	'normalize':       normalizeCommand,
	'normalize*':      normalizeStarCommand,
	'normalize#':      normalizeHashCommand,
	'dataflow':        dataflowCommand,
	'dataflow*':       dataflowStarCommand,
	'dataflowsimple':  dataflowSimplifiedCommand,
	'dataflowsimple*': dataflowSimpleStarCommand,
	'dataflowascii':   dataflowAsciiCommand,
	'dataflowsilent':  dataflowSilentCommand,
	'controlflow':     controlflowCommand,
	'controlflow*':    controlflowStarCommand,
	'controlflowbb':   controlflowBbCommand,
	'controlflowbb*':  controlflowBbStarCommand,
	'query':           queryCommand,
	'query*':          queryStarCommand,
	'signature':       signatureCommand
} as const satisfies Record<string, ReplCommand | ReplCodeCommand>;

export type ReplCommandNames = keyof typeof _commands | keyof typeof scripts;

let commandsInitialized = false;

function hasModule(path: string): boolean {
	try {
		require.resolve(path);
		return true;
	} catch{
		return false;
	}
}


/**
 * Retrieve all REPL commands (including those generated from master scripts)
 */
export function getReplCommands(): Record<string, ReplCommand | ReplCodeCommand> {
	if(commandsInitialized) {
		return _commands;
	}
	commandsInitialized = true;
	for(const [script, { target, description, type }] of Object.entries(scripts)) {
		if(type === 'master script') {
			(_commands as Record<string, ReplCommand | ReplCodeCommand>)[script] = {
				description,
				aliases:       [],
				script:        true,
				usageExample:  `:${script} --help`,
				isCodeCommand: false,
				fn:            async({ output, remainingLine }) => {
					// check if the target *module* exists in the current directory, else try two dirs up, otherwise, fail with a message
					let path = `${__dirname}/${target}`;
					if(!hasModule(path)) {
						path = `${__dirname}/../../${target}`;
						if(!hasModule(path)) {
							output.stderr(`Could not find the target script ${target} in the current directory or two directories up.`);
							return;
						}
					}
					await waitOnScript(
						path,
						splitAtEscapeSensitive(remainingLine),
						stdio => stdioCaptureProcessor(stdio, msg => output.stdout(msg), msg => output.stderr(msg))
					);
				}
			};
		}
	}
	return _commands;
}


/**
 * The names of all commands including their aliases (but without the leading `:`)
 */
export function getCommandNames(): string[] {
	if(commandNames === undefined) {
		initCommandMapping();
	}
	return commandNames as string[];
}
let commandNames: string[] | undefined = undefined;
// maps command names or aliases to the actual command name
let commandMapping: Record<string, string> | undefined = undefined;

function initCommandMapping() {
	commandMapping = {};
	commandNames = [];
	for(const [command, { aliases }] of Object.entries(getReplCommands())) {
		guard(commandMapping[command] as string | undefined === undefined, `Command ${command} is already registered!`);
		commandMapping[command] = command;
		for(const alias of aliases) {
			guard(commandMapping[alias] as string | undefined === undefined, `Command (alias) ${alias} is already registered!`);
			commandMapping[alias] = command;
		}
		commandNames.push(command);
		commandNames.push(...aliases);
	}
}

/**
 * Get the command for a given command name or alias.
 * @param command - The name of the command (without the leading `:`)
 */
export function getCommand(command: string): ReplCodeCommand | ReplCommand | undefined {
	if(commandMapping === undefined) {
		initCommandMapping();
	}
	return getReplCommands()[(commandMapping as Record<string, string>)[command] as keyof typeof _commands];
}

/**
 * Formats the given argument name as a command line option (with single or double dashes).
 */
export function asOptionName(argument: string): string{
	if(argument.length == 1) {
		return `-${argument}`;
	} else {
		return `--${argument}`;
	}
}


let _longestCommandName: number | undefined = undefined;

/**
 * Retrieve the length of the longest command name (including star and brackets if applicable)
 */
export function longestCommandName(): number {
	if(_longestCommandName === undefined) {
		_longestCommandName = Array.from(Object.keys(getReplCommands()), k => k.endsWith('*') ? k.length + 3 : k.length).reduce((p, n) => Math.max(p, n), 0);
	}
	return _longestCommandName;
}

/**
 * Pad the given command string to the length of the longest command name plus two spaces.
 * @see {@link longestCommandName}
 */
export function padCmd<T>(string: T) {
	return String(string).padEnd(longestCommandName() + 2, ' ');
}
