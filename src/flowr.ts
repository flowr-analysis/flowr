/**
 * The main script to run flowR.
 *
 * If started with arguments it may be used to run a single of the flowR scripts.
 * Otherwise, it will start a REPL that can call these scripts and return their results repeatedly.
 */
import { log, LogLevel } from './util/log'
import { RShell } from './r-bridge'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import commandLineArgs from 'command-line-args'
import { guard } from './util/assert'
import { bold, ColorEffect, Colors, FontStyles, formatter, italic, setFormatter, voidFormatter } from './statistics'
import { repl } from './cli/repl/core'
import { ScriptInformation, scripts } from './cli/common/scripts-info'
import { waitOnScript } from './cli/repl'
import { DeepReadonly } from 'ts-essentials'
import { version } from '../package.json'

const scriptsText = Array.from(Object.entries(scripts).filter(([, {type}]) => type === 'master script'), ([k,]) => k).join(', ')

export const toolName = 'flowr'

export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging (will be passed to the corresponding script)' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide (or the guide of the corresponding script)' },
	{ name: 'version',      alias: 'V', type: Boolean, description: 'Provide information about the version of flowR as well as its underlying R system and exit.' },
	{ name: 'no-ansi',                  type: Boolean, description: 'Disable ansi-escape-sequences in the output. Useful, if you want to redirect the output to a file.'},
	{ name: 'script',       alias: 's', type: String,  description: `The sub-script to run (${scriptsText})`, multiple: false, defaultOption: true, typeLabel: '{underline files}', defaultValue: undefined },
]

export interface FlowrCliOptions {
	verbose:   boolean
	version:   boolean
	help:      boolean
	'no-ansi': boolean
	script:    string | undefined
}

export const optionHelp = [
	{
		header:  'flowR',
		content: 'A static dataflow analyzer and program slicer for R programs'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {bold --help}`,
			`$ ${toolName} {bold --version}`,
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

async function printVersionInformation() {
	console.log(`flowR: ${String(version)}`)
}


async function main() {
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

	log.logToFile()

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

	const end = () => {
		console.log(`\n${italic('Exiting...')}`)
		shell.close()
		process.exit(0)
	}

	// hook some handlers
	process.on('SIGINT', end)
	process.on('SIGTERM', end)

	await repl(shell)
}

void main()
