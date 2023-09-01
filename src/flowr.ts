/**
 * The main script to run flowR.
 *
 * If started with arguments it may be used to run a single of the flowR scripts.
 * Otherwise, it will start a REPL that can call these scripts and return their results repeatedly.
 */
import { log, LogLevel } from './util/log'
import { getStoredTokenMap, RShell } from './r-bridge'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import commandLineArgs from 'command-line-args'
import { guard } from './util/assert'
import { bold, ColorEffect, Colors, FontStyles, formatter, italic, setFormatter, voidFormatter } from './statistics'
import { repl, replProcessAnswer, waitOnScript } from './cli/repl'
import { ScriptInformation, scripts } from './cli/common'
import { DeepReadonly } from 'ts-essentials'
import { version } from '../package.json'
import { printVersionInformation } from './cli/repl/commands/version'
import { FlowRServer } from './cli/repl/server/server'

const scriptsText = Array.from(Object.entries(scripts).filter(([, {type}]) => type === 'master script'), ([k,]) => k).join(', ')

export const toolName = 'flowr'

export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging (will be passed to the corresponding script)' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide (or the guide of the corresponding script)' },
	{ name: 'version',      alias: 'V', type: Boolean, description: 'Provide information about the version of flowR as well as its underlying R system and exit.' },
	{ name: 'server',                   type: Boolean, description: 'Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.' },
	{ name: 'port' ,                    type: Number,  description: 'The port to listen on, if --server is given.', defaultValue: 1042, typeLabel: '{underline port}' },
	{ name: 'execute',      alias: 'e', type: String,  description: 'Execute the given command and exit. Use a semicolon ";" to separate multiple commands.', typeLabel: '{underline command}', multiple: false },
	{ name: 'no-ansi',                  type: Boolean, description: 'Disable ansi-escape-sequences in the output. Useful, if you want to redirect the output to a file.'},
	{ name: 'script',       alias: 's', type: String,  description: `The sub-script to run (${scriptsText})`, multiple: false, defaultOption: true, typeLabel: '{underline files}', defaultValue: undefined },
]

export interface FlowrCliOptions {
	verbose:   boolean
	version:   boolean
	help:      boolean
	server:    boolean
	port:      number
	'no-ansi': boolean
	execute:   string | undefined
	script:    string | undefined
}

export const optionHelp = [
	{
		header:  `flowR (version ${String(version)})`,
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
		optionList: optionDefinitions
	}
]

const options = commandLineArgs(optionDefinitions) as FlowrCliOptions

log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)

if(options['no-ansi']) {
	log.info('disabling ansi colors')
	setFormatter(voidFormatter)
}


function retrieveShell(): RShell {
	// we keep an active shell session to allow other parse investigations :)
	const shell = new RShell({
		revive:   'always',
		onRevive: (code, signal) => {
			const signalText = signal == null ? '' : ` and signal ${signal}`
			console.log(formatter.format(`R process exited with code ${code}${signalText}. Restarting...`, { color: Colors.magenta, effect: ColorEffect.foreground }))
			console.log(italic(`If you want to exit, press either Ctrl+C twice, or enter ${bold(':quit')}`))
		},
	})
	shell.tryToInjectHomeLibPath()
	return shell
}

async function mainRepl() {
	if(options.script) {
		let target = (scripts as DeepReadonly<Record<string, ScriptInformation>>)[options.script].target as string | undefined
		guard(target !== undefined, `Unknown script ${options.script}, pick one of ${scriptsText}.`)
		console.log(`Running script '${formatter.format(options.script, { style: FontStyles.bold })}'`)
		target = `cli/${target}`
		log.debug(`Script maps to "${target}"`)
		await waitOnScript(`${__dirname}/${target}`, process.argv.slice(3))
		process.exit(0)
	}

	if(options.help) {
		console.log(commandLineUsage(optionHelp))
		process.exit(0)
	}

	if(options.version) {
		await printVersionInformation()
		process.exit(0)
	}

	const shell = retrieveShell()

	const end = () => {
		if(options.execute === undefined) {
			console.log(`\n${italic('Exiting...')}`)
		}
		shell.close()
		process.exit(0)
	}

	// hook some handlers
	process.on('SIGINT', end)
	process.on('SIGTERM', end)

	const tokenMap = await getStoredTokenMap(shell)

	if(options.execute) {
		await replProcessAnswer(options.execute, shell, tokenMap)
	} else {
		await repl(shell, tokenMap)
	}
	process.exit(0)
}

async function mainServer() {
	const shell = retrieveShell()
	const tokenMap = await getStoredTokenMap(shell)
	const end = () => {
		if(options.execute === undefined) {
			console.log(`\n${italic('Exiting...')}`)
		}
		shell.close()
		process.exit(0)
	}

	// hook some handlers
	process.on('SIGINT', end)
	process.on('SIGTERM', end)
	await new FlowRServer(shell, tokenMap).start(options.port)
}

if(options.server) {
	void mainServer()
} else {
	void mainRepl()
}
