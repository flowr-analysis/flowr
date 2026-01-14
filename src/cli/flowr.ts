/**
 * The main script to run flowR.
 *
 * If started with arguments, it may be used to run a single of the flowR scripts.
 * Otherwise, it will start a REPL that can call these scripts and return their results repeatedly.
 */
import type { DeepReadonly } from 'ts-essentials';
import { FlowRServer } from './repl/server/server';
import { NetServer, type Server, WebSocketServerWrapper } from './repl/server/net';
import { flowrVersion, printVersionInformation } from '../util/version';
import commandLineUsage from 'command-line-usage';
import { log, LogLevel } from '../util/log';
import {
	ansiFormatter,
	ColorEffect,
	Colors,
	FontStyles,
	formatter,
	italic,
	setFormatter,
	voidFormatter
} from '../util/text/ansi';
import commandLineArgs from 'command-line-args';
import {
	amendConfig,
	type EngineConfig,
	type FlowrConfigOptions,
	getConfig,
	type KnownEngines,
	parseConfig
} from '../config';
import { guard } from '../util/assert';
import { type ScriptInformation, scripts } from './common/scripts-info';
import { waitOnScript } from './repl/execute';
import { standardReplOutput } from './repl/commands/repl-main';
import { repl, replProcessAnswer } from './repl/core';
import { printVersionRepl } from './repl/print-version';
import { defaultConfigFile, flowrMainOptionDefinitions, getScriptsText } from './flowr-main-options';
import type { KnownParser } from '../r-bridge/parser';
import fs from 'fs';
import path from 'path';
import { retrieveEngineInstances } from '../engines';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';

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
	'default-engine':   string

	'engine.r-shell.disabled': boolean
	'engine.r-shell.r-path':   string | undefined

	'engine.tree-sitter.disabled':              boolean
	'engine.tree-sitter.wasm-path':             string | undefined
	'engine.tree-sitter.tree-sitter-wasm-path': string | undefined
	'engine.tree-sitter.lax':                   boolean
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

function createConfig(): FlowrConfigOptions {
	let config: FlowrConfigOptions | undefined;

	if(options['config-json']) {
		const passedConfig = parseConfig(options['config-json']);
		if(passedConfig) {
			log.info(`Using passed config ${JSON.stringify(passedConfig)}`);
			config = passedConfig;
		}
	}
	if(config == undefined) {
		if(options['config-file']) {
			// validate it exists
			if(!fs.existsSync(path.resolve(options['config-file']))) {
				log.error(`Config file '${options['config-file']}' does not exist`);
				process.exit(1);
			}
		}
		config = getConfig(options['config-file'] ?? defaultConfigFile);
	}


	// for all options that we manually supply that have a config equivalent, set them in the config
	config = amendConfig(config, c => {
		(c.engines as EngineConfig[]) ??= [];

		if(!options['engine.r-shell.disabled']) {
			c.engines.push({ type: 'r-shell', rPath: options['r-path'] || options['engine.r-shell.r-path'] });
		}

		if(!options['engine.tree-sitter.disabled']) {
			c.engines.push({
				type:               'tree-sitter',
				wasmPath:           options['engine.tree-sitter.wasm-path'],
				treeSitterWasmPath: options['engine.tree-sitter.tree-sitter-wasm-path'],
				lax:                options['engine.tree-sitter.lax']
			});
		}

		if(options['default-engine']) {
			(c.defaultEngine as string) = options['default-engine'] as EngineConfig['type'];
		}

		return c;
	});

	return config;
}

function hookSignalHandlers(engines: { engines: KnownEngines; default: keyof KnownEngines }) {
	const end = () => {
		if(options.execute === undefined) {
			console.log(`\n${italic('Exiting...')}`);
		}
		Object.values(engines.engines).forEach(e => e?.close());
		process.exit(0);
	};

	process.on('SIGINT', end);
	process.on('SIGTERM', end);
}

async function mainRepl() {
	const config = createConfig();

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

	const engines = await retrieveEngineInstances(config);
	const defaultEngine = engines.engines[engines.default] as KnownParser;

	if(options.version) {
		for(const engine of Object.values(engines.engines)) {
			await printVersionInformation(standardReplOutput, engine);
			engine?.close();
		}
		process.exit(0);
	}
	hookSignalHandlers(engines);

	const analyzer = new FlowrAnalyzerBuilder()
		.setParser(defaultEngine)
		.setConfig(config)
		.buildSync();

	const allowRSessionAccess = options['r-session-access'] ?? false;
	if(options.execute) {
		await replProcessAnswer(analyzer, standardReplOutput, options.execute, allowRSessionAccess);
	} else {
		await printVersionRepl(defaultEngine);
		const w = (x: string) => ansiFormatter.format(x, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
		console.log(w('use ') + ansiFormatter.format(':help', { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Bold })  + w(' to get a list of available commands.'));
		await repl({ analyzer: analyzer, allowRSessionAccess });
	}
	process.exit(0);
}

async function mainServer(backend: Server = new NetServer()) {
	const config = createConfig();
	const engines = await retrieveEngineInstances(config);
	hookSignalHandlers(engines);
	await new FlowRServer(engines.engines, engines.default, options['r-session-access'], config, backend).start(options.port);
}


if(options.server) {
	void mainServer(options.ws ? new WebSocketServerWrapper() : new NetServer());
} else {
	void mainRepl();
}
