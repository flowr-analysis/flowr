import {
  decorateAst, DecoratedAst,
  getStoredTokenMap, NodeId,
  NoInfo, ParentInformation,
  retrieveAstFromRCode,
  RParseRequestFromFile,
  RShell
} from '../r-bridge'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import fs from 'fs'
import { conventionalCriteriaToId, locationToId, naiveStaticSlicing } from '../slicing/static'
import { assert } from 'chai'
import { guard, isNotUndefined } from '../util/assert'
import { produceDataFlowGraph } from '../dataflow'
import { reconstructToCode } from '../slicing/reconstruct'

export const toolName = 'slicer'

export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'input',        alias: 'i', type: String,  description: '(Required) Pass a single file to slice', multiple: false, defaultOption: true, typeLabel: '{underline files}' },
  { name: 'criterion',    alias: 'c', type: String,  description: '(Required) Slicing criterion either in the form {underline line:col} or {underline line@variable}, multiple can be separated by \'{bold ;}\'', multiple: false },
  // TODO: forward vs. backward slicing
  { name: 'output',       alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to {italic <input>.slice})', typeLabel: '{underline file}' },
]

export interface SlicerCliOptions {
  verbose:   boolean
  help:      boolean
  input:     string | undefined
  criterion: string | undefined
  output:    string | undefined
}

export const optionHelp = [
  {
    header:  'Static backwards executable slicer for R',
    content: 'Slice R code based on a given slicing criterion'
  },
  {
    header:  'Synopsis',
    content: [
      `$ ${toolName} {bold -i} {italic example.R} {bold --criterion} {italic 7:3}`,
      `$ ${toolName} {bold -i} {italic example.R} {bold --criterion} {italic "8:3;3:1;12@product"}`,
      `$ ${toolName} {bold --help}`
    ]
  },
  {
    header:     'Options',
    optionList: optionDefinitions
  }
]

const options = commandLineArgs(optionDefinitions) as SlicerCliOptions

if(options.help || !options.input || !options.criterion) {
  console.log(commandLineUsage(optionHelp))
  process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

function slicingCriterionToId(criterion: string, decorated: DecoratedAst<ParentInformation>): NodeId | undefined {
  if(criterion.includes(':')) {
    const [line, column] = criterion.split(':').map(c => parseInt(c))
    return locationToId({ line, column }, decorated.idMap)
  } else if(criterion.includes('@')) {
    const [line, name] = criterion.split(/@(.*)/s) // only split at first occurence
    return conventionalCriteriaToId(parseInt(line), name, decorated.idMap)
  }
}

function sliceAllCriteriaToIds(slices: string[], decorated: DecoratedAst<ParentInformation>): NodeId[] {
  return slices.map(l => slicingCriterionToId(l, decorated)).map((d, i) => {
    assert(isNotUndefined(d), `all ids must be found, but not for id ${i}`)
    console.log(`Slicing for ${JSON.stringify(decorated.idMap.get(d)?.lexeme)} (loc: ${JSON.stringify(decorated.idMap.get(d)?.location)}, from: ${slices[i]})`)
    return d
  })
}

async function writeSliceForSingleFile(request: RParseRequestFromFile, tokens: Record<string, string>, output: string) {
  const ast = await retrieveAstFromRCode({
    ...request,
    attachSourceInformation: true,
    ensurePackageInstalled:  true
  }, tokens, shell)
  guard(options.criterion !== undefined, `criterion must be given`)
  const decorated = decorateAst(ast)
  const slices = options.criterion.split(';').map(c => c.trim())

  const mappedIds = sliceAllCriteriaToIds(slices, decorated)

  const dataflow = produceDataFlowGraph(decorated)

  const sliced = naiveStaticSlicing(dataflow.graph, decorated.idMap, mappedIds)
  const reconstructed = reconstructToCode<NoInfo>(decorated, sliced)

  log.info(`Writing slice to ${output}`)
  fs.writeFileSync(output, reconstructed)
}

async function getSlice() {
  const tokens = await getStoredTokenMap(shell)
  guard(options.input !== undefined, `input must be given`)
  const output = options.output ?? `${options.input}.slice`
  const request: RParseRequestFromFile = { request: 'file', content: options.input }
  try {
    await writeSliceForSingleFile(request, tokens, output)
  } catch (e: unknown) {
    log.error(`[Skipped] Error while processing ${request.content}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
  }
  shell.close()
}

void getSlice()

