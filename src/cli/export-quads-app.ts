import { decorateAst, getStoredTokenMap, retrieveAstFromRCode, RShell } from '../r-bridge'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { serialize2quads } from '../util/quads'
import path from 'path'
import fs from 'fs'

export const toolName = 'export-quads'


export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'input',        alias: 'i', type: String,  description: 'Pass an R-file as src to read from', defaultOption: true, typeLabel: '{underline file}' },
  { name: 'output',       alias: 'o', type: String,  description: 'File to write the generated quads to (defaults to {italic <input-file-name>.quads})', typeLabel: '{underline file}' },
]

export interface QuadsCliOptions {
  verbose: boolean
  help:    boolean
  input:   string
  output:  string
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

async function getQuads() {
  const tokens = await getStoredTokenMap(shell)

  const ast = await retrieveAstFromRCode({ request: 'file', content: options.input, attachSourceInformation: true, ensurePackageInstalled: true }, tokens, shell)
  const decorated = decorateAst(ast).decoratedAst
  const serialized = serialize2quads(decorated, { context: options.input })
  const output = options.output ?? `${path.parse(options.input).name}.quads`
  log.info(`Writing quads to ${output}`)
  fs.writeFileSync(output, serialized)
  shell.close()
}

void getQuads()

