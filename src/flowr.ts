/**
 * The main script to run flowR.
 *
 * If started with arguments it may be used to run a single of the flowR scripts.
 * Otherwise, it will start a REPL that can call these scripts and return their results repeatedly.
 * TODO: this should allow to use flowR as some kind of server that repeatedly can answer
 */
import * as readline from 'readline'
import { log, LogLevel } from './util/log'
import { getStoredTokenMap, retrieveAstFromRCode, RShell, TokenMap } from './r-bridge'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import commandLineArgs from 'command-line-args'
import cp from 'child_process'
import { guard } from './util/assert'
import { FontWeights, formatter, setFormatter, voidFormatter } from './statistics'
import { repl } from './cli/repl'


const validScripts = new Map<string, string>()
validScripts.set('benchmark',        'cli/benchmark-app')
validScripts.set('benchmark-helper', 'cli/benchmark-helper-app')
validScripts.set('stats',            'cli/statistics-app')
validScripts.set('slicer',           'cli/slicer-app')
validScripts.set('summarizer',       'cli/summarizer-app')
validScripts.set('export-quads',     'cli/export-quads-app')
const scriptsText = Array.from(validScripts.keys()).join(', ')

export const toolName = 'flowr'

// TODO: allow to give a port to connect to which allows to send request and send answers
export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging (will be passed to the corresponding script)' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide (or the guide of the corresponding script)' },
	{ name: 'no-ansi',                  type: Boolean, description: 'Disable ansi-escape-sequences in the output. Useful, if you want to redirect the output to a file.'},
	{ name: 'script',       alias: 's', type: String,  description: `The sub-script to run (${scriptsText})`, multiple: false, defaultOption: true, typeLabel: '{underline files}', defaultValue: null },
]

export interface FlowrCliOptions {
	verbose:   boolean
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

async function waitOnScript(module: string, args: string[]): Promise<void> {
	const child = cp.fork(module, args)
	child.on('exit', (code, signal) => {
		if (code) {
			console.error(`Script ${module} exited with code ${JSON.stringify(code)} and signal ${JSON.stringify(signal)}`)
			process.exit(code)
		}
	})
	await new Promise<void>(resolve => child.on('exit', resolve))
}


async function main() {
	if(options.script) {
		const target = validScripts.get(options.script)
		guard(target !== undefined, `Unknown script ${options.script}, pick one of ${scriptsText}.`)
		console.log(`Running script '${formatter.format(options.script, { weight: FontWeights.bold })}'`)
		log.debug(`Script maps to "${target}"`)
		await waitOnScript(`${__dirname}/${target}`, process.argv.slice(3))
		process.exit(0)
	}

	if (options.help) {
		console.log(commandLineUsage(optionHelp))
		process.exit(0)
	}

	log.logToFile()

	// we keep an active shell session to allow other parse investigations :)
	const shell = new RShell()
	shell.tryToInjectHomeLibPath()

	repl(shell)
}

void main()
