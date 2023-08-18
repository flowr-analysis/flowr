import { decorateAst, getStoredTokenMap, retrieveAstFromRCode, RParseRequestFromFile, RShell } from '../r-bridge'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { serialize2quads } from '../util/quads'
import fs from 'fs'
import { allRFilesFrom } from '../util/files'

export const toolName = 'export-quads'


export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
	{ name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
	{ name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process'},
	{ name: 'output',       alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to {italic out.quads})', typeLabel: '{underline file}' },
]

export interface QuadsCliOptions {
  verbose: boolean
  help:    boolean
  input:   string[]
  limit:   number
  output:  string | undefined
}

export const optionHelp = [
	{
		header:  'Convert R-Code to Quads',
		content: 'Generate RDF N-Quads from the AST of a given R script'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {bold -i} {italic example.R} {bold --output} {italic "example.quads"}`,
			`$ ${toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: optionDefinitions
	}
]

const options = commandLineArgs(optionDefinitions) as QuadsCliOptions

if(options.help) {
	console.log(commandLineUsage(optionHelp))
	process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

async function writeQuadForSingleFile(request: RParseRequestFromFile, tokens: Record<string, string>, output: string) {
	const ast = await retrieveAstFromRCode({
		...request,
		attachSourceInformation: true,
		ensurePackageInstalled:  true
	}, tokens, shell)
	const decorated = decorateAst(ast).decoratedAst
	const serialized = serialize2quads(decorated, { context: request.content })
	log.info(`Appending quads to ${output}`)
	fs.appendFileSync(output, serialized)
}

async function getQuads() {
	const tokens = await getStoredTokenMap(shell)
	const output = options.output ?? `out.quads`
	let skipped = 0
	for await (const request of allRFilesFrom(options.input, options.limit)) {
		try {
			await writeQuadForSingleFile(request, tokens, output)
		} catch (e: unknown) {
			log.error(`[Skipped] Error while processing ${request.content}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
			skipped++
		}
	}
	console.log(`Skipped ${skipped} files`)
	shell.close()
}

void getQuads()

