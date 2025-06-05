import { quitCommand } from './repl-quit';
import { stdioCaptureProcessor, waitOnScript } from '../execute';
import type { ReplCommand } from './repl-main';
import { rawPrompt } from '../prompt';
import { versionCommand } from './repl-version';
import { parseCommand } from './repl-parse';
import { executeCommand } from './repl-execute';
import { normalizeCommand, normalizeStarCommand } from './repl-normalize';
import {
	dataflowCommand,
	dataflowSimpleStarCommand,
	dataflowSimplifiedCommand,
	dataflowStarCommand
} from './repl-dataflow';
import { controlflowBbCommand, controlflowBbStarCommand, controlflowCommand, controlflowStarCommand } from './repl-cfg';
import type { OutputFormatter } from '../../../util/text/ansi';
import { italic , bold } from '../../../util/text/ansi';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { guard } from '../../../util/assert';
import { scripts } from '../../common/scripts-info';
import { lineageCommand } from './repl-lineage';
import { queryCommand, queryStarCommand } from './repl-query';

function printHelpForScript(script: [string, ReplCommand], f: OutputFormatter, starredVersion?: ReplCommand): string {
	let base = `  ${bold(padCmd(':' + script[0] + (starredVersion ? '[*]' : '')), f)}${script[1].description}`;
	if(starredVersion) {
		base += ` (star: ${starredVersion.description})`;
	}
	if(script[1].aliases.length === 0) {
		return base;
	}
	const aliases = script[1].aliases;
	return `${base} (alias${aliases.length > 1 ? 'es' : ''}: ${aliases.map(a => bold(':' + a, f)).join(', ')})`;
}

function printCommandHelp(formatter: OutputFormatter) {
	const scriptHelp = [];
	const cmds = getReplCommands();
	for(const c of Object.entries(cmds)) {
		if(c[1].script || c[0].endsWith('*')) {
			continue;
		}
		const starred =  cmds[c[0] + '*'];
		scriptHelp.push(printHelpForScript(c, formatter, starred));
	}

	return scriptHelp.sort().join('\n');
}

export const helpCommand: ReplCommand = {
	description:  'Show help information',
	script:       false,
	usageExample: ':help',
	aliases:      [ 'h', '?' ],
	fn:           output => {
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
		([command, { description }]) => `  ${bold(padCmd(':' + command), output.formatter)}${description}`).sort().join('\n')
}

You can combine commands by separating them with a semicolon ${bold(';',output.formatter)}.
`);
	}
};

/**
 * All commands that should be available in the REPL.
 */
const _commands: Record<string, ReplCommand> = {
	'help':            helpCommand,
	'quit':            quitCommand,
	'version':         versionCommand,
	'execute':         executeCommand,
	'parse':           parseCommand,
	'normalize':       normalizeCommand,
	'normalize*':      normalizeStarCommand,
	'dataflow':        dataflowCommand,
	'dataflow*':       dataflowStarCommand,
	'dataflowsimple':  dataflowSimplifiedCommand,
	'dataflowsimple*': dataflowSimpleStarCommand,
	'controlflow':     controlflowCommand,
	'controlflow*':    controlflowStarCommand,
	'controlflowbb':   controlflowBbCommand,
	'controlflowbb*':  controlflowBbStarCommand,
	'lineage':         lineageCommand,
	'query':           queryCommand,
	'query*':          queryStarCommand
};
let commandsInitialized = false;

function hasModule(path: string): boolean {
	try {
		require.resolve(path);
		return true;
	} catch{
		return false;
	}
}

export function getReplCommands() {
	if(commandsInitialized) {
		return _commands;
	}
	commandsInitialized = true;
	for(const [script, { target, description, type }] of Object.entries(scripts)) {
		if(type === 'master script') {
			_commands[script] = {
				description,
				aliases:      [],
				script:       true,
				usageExample: `:${script} --help`,
				fn:           async(output, _s, remainingLine) => {
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
export function getCommand(command: string): ReplCommand | undefined {
	if(commandMapping === undefined) {
		initCommandMapping();
	}
	return getReplCommands()[(commandMapping as Record<string, string>)[command]];
}

export function asOptionName(argument: string): string{
	if(argument.length == 1) {
		return `-${argument}`;
	} else {
		return `--${argument}`;
	}
}


let _longestCommandName: number | undefined = undefined;
export function longestCommandName(): number {
	if(_longestCommandName === undefined) {
		_longestCommandName = Array.from(Object.keys(getReplCommands()), k => k.endsWith('*') ? k.length + 3 : k.length).reduce((p, n) => Math.max(p, n), 0);
	}
	return _longestCommandName;
}
export function padCmd<T>(string: T) {
	return String(string).padEnd(longestCommandName() + 2, ' ');
}
