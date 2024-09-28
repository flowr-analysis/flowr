/**
 * The main script to run flowR.
 *
 * If started with arguments, it may be used to run a single of the flowR scripts.
 * Otherwise, it will start a REPL that can call these scripts and return their results repeatedly.
 */
import type { DeepReadonly } from 'ts-essentials';
import { FlowRServer } from './repl/server/server';
import type { Server } from './repl/server/net';
import { NetServer, WebSocketServerWrapper } from './repl/server/net';
import { flowrVersion } from '../util/version';
import commandLineUsage from 'command-line-usage';
import { log, LogLevel } from '../util/log';
import { bold, ColorEffect, Colors, FontStyles, formatter, italic, setFormatter, voidFormatter } from '../util/ansi';
import commandLineArgs from 'command-line-args';
import { parseConfig, setConfig, setConfigFile } from '../config';


import { guard } from '../util/assert';
import type { ScriptInformation } from './common/scripts-info';
import { scripts } from './common/scripts-info';
import type { RShellOptions } from '../r-bridge/shell';
import { RShell, RShellReviveOptions } from '../r-bridge/shell';
import { waitOnScript } from './repl/execute';
import { standardReplOutput } from './repl/commands/repl-main';
import { repl, replProcessAnswer } from './repl/core';
import { printVersionInformation } from './repl/commands/repl-version';
import { printVersionRepl } from './repl/print-version';
import { flowrMainOptionDefinitions, getScriptsText } from './flowr-main-options';

export const toolName = 'flowr';

export interface FlowrCliOptions {
	'config-file':      string
	'config-json':      string
	'no-ansi':          boolean
	'r-path':           string | undefined
	'r-session-access': boolean
	execute:            string | undefined
	help:               boolean
	port:               number
	script:             string | undefined
	server:             boolean
	verbose:            boolean
	version:            boolean
	ws:                 boolean
}

export const optionHelp = [
	{
		header:  `flowR (version ${flowrVersion().toString()})`,
		content: 'A static dataflow analyzer and program slicer for R programs'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {bold --help}`,
			`$ ${toolName} {bold --version}`,
			`$ ${toolName} {bold --server}`,
			`$ ${toolName} {bold --execute} {italic ":parse 2 - 4"}`,
			`$ ${toolName} {bold slicer} {bold --help}`,
		]
	},
	{
		header:     'Options',
		optionList: flowrMainOptionDefinitions
	}
];

const options = commandLineArgs(flowrMainOptionDefinitions) as FlowrCliOptions;

log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.Trace : LogLevel.Error);
log.info('running with options', options);

if(options['no-ansi']) {
	log.info('disabling ansi colors');
	setFormatter(voidFormatter);
}

export const defaultConfigFile = 'flowr.json';
let usedConfig = false;
if(options['config-json']) {
	const config = parseConfig(options['config-json']);
	if(config) {
		log.info(`Using passed config ${JSON.stringify(config)}`);
		setConfig(config);
		usedConfig = true;
	}
}
if(!usedConfig) {
	setConfigFile(options['config-file'] ?? defaultConfigFile, undefined, true);
}

function retrieveShell(): RShell {
	// we keep an active shell session to allow other parse investigations :)
	let opts: Partial<RShellOptions> = {
		revive:   RShellReviveOptions.Always,
		onRevive: (code, signal) => {
			const signalText = signal == null ? '' : ` and signal ${signal}`;
			console.log(formatter.format(`R process exited with code ${code}${signalText}. Restarting...`, { color: Colors.Magenta, effect: ColorEffect.Foreground }));
			console.log(italic(`If you want to exit, press either Ctrl+C twice, or enter ${bold(':quit')}`));
		}
	};
	if(options['r-path']) {
		opts = { ...opts, pathToRExecutable: options['r-path'] };
	}
	return new RShell(opts);
}

async function mainRepl() {
	if(options.script) {
		const target = (scripts as DeepReadonly<Record<string, ScriptInformation>>)[options.script].target as string | undefined;
		guard(target !== undefined, `Unknown script ${options.script}, pick one of ${getScriptsText()}.`);
		console.log(`Running script '${formatter.format(options.script, { style: FontStyles.Bold })}'`);
		log.debug(`Script maps to "${target}"`);
		await waitOnScript(`${__dirname}/${target}`, process.argv.slice(3), undefined, true);
		process.exit(0);
	}

	if(options.help) {
		console.log(commandLineUsage(optionHelp));
		process.exit(0);
	}

	if(options.version) {
		const shell = new RShell();
		process.on('exit', () => shell.close());
		await printVersionInformation(standardReplOutput, shell);
		process.exit(0);
	}

	const shell = retrieveShell();

	const end = () => {
		if(options.execute === undefined) {
			console.log(`\n${italic('Exiting...')}`);
		}
		shell.close();
		process.exit(0);
	};

	// hook some handlers
	process.on('SIGINT', end);
	process.on('SIGTERM', end);

	const allowRSessionAccess = options['r-session-access'] ?? false;
	if(options.execute) {
		await replProcessAnswer(standardReplOutput, options.execute, shell, allowRSessionAccess);
	} else {
		await printVersionRepl(shell);
		await repl({ shell, allowRSessionAccess });
	}
	process.exit(0);
}

async function mainServer(backend: Server = new NetServer()) {
	const shell = retrieveShell();

	const end = () => {
		if(options.execute === undefined) {
			console.log(`\n${italic('Exiting...')}`);
		}
		shell.close();
		process.exit(0);
	};

	// hook some handlers
	process.on('SIGINT', end);
	process.on('SIGTERM', end);
	await new FlowRServer(shell, options['r-session-access'], backend).start(options.port);
}


if(options.server) {
	void mainServer(options.ws ? new WebSocketServerWrapper() : new NetServer());
} else {
	void mainRepl();
}
