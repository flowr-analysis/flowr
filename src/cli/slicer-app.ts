import {
  decorateAst,
  getStoredTokenMap,
  NoInfo, normalize,
  retrieveXmlFromRCode,
  RParseRequestFromFile,
  RShell
} from '../r-bridge'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import fs from 'fs'
import { staticSlicing } from '../slicing/static'
import { guard } from '../util/assert'
import { graphToMermaid, produceDataFlowGraph } from '../dataflow'
import { reconstructToCode } from '../slicing/reconstruct'
import { convertAllSlicingCriteriaToIds, SlicingCriteria } from '../slicing/criterion/parse'

export const toolName = 'slicer'

export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'input',        alias: 'i', type: String,  description: '(Required) Pass a single file to slice', multiple: false, defaultOption: true, typeLabel: '{underline files}' },
  { name: 'criterion',    alias: 'c', type: String,  description: '(Required) Slicing criterion either in the form {underline line:col} or {underline line@variable}, multiple can be separated by \'{bold ;}\'', multiple: false },
  { name: 'stats',        alias: 's', type: Boolean, description: `Print stats to {italic <output>.stats} (runtimes etc.)`, multiple: false },
  { name: 'dataflow',     alias: 'd', type: Boolean, description: `Dump mermaid code for the dataflow to {italic <output>.dataflow}`, multiple: false },
  // TODO: forward vs. backward slicing
  { name: 'output',       alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to {italic <input>.slice})', typeLabel: '{underline file}' },
]

export interface SlicerCliOptions {
  verbose:   boolean
  help:      boolean
  input:     string | undefined
  criterion: string | undefined
  output:    string | undefined
  stats:     boolean
  dataflow:  boolean
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
      `$ ${toolName} {bold -i} {italic example.R} {bold --stats} {bold --criterion} {italic "8:3;3:1;12@product"}`,
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

const shellInit = process.hrtime.bigint()
const shell = new RShell()
shell.tryToInjectHomeLibPath()


interface SlicingMeasurements {
  astXmlRetrieval:     bigint,
  astXmlNormalization: bigint,
  astDecoration:       bigint,
  sliceDecode:         bigint,
  sliceMapping:        bigint,
  dataflowCreation:    bigint,
  sliceCreation:       bigint,
  reconstruction:      bigint,
  sliceWrite:          bigint
}

async function writeSliceForSingleFile(request: RParseRequestFromFile, tokens: Record<string, string>, output: string): Promise<SlicingMeasurements> {
  const astXml = await retrieveXmlFromRCode({
    ...request,
    attachSourceInformation: true,
    ensurePackageInstalled:  true
  }, shell)
  const astXmlRetrieval = process.hrtime.bigint()
  const ast = await normalize(astXml, tokens)
  const astXmlNormalization = process.hrtime.bigint()

  guard(options.criterion !== undefined, `criterion must be given`)

  const decorated = decorateAst(ast)
  const astDecoration = process.hrtime.bigint()

  const slices = options.criterion.split(';').map(c => c.trim())
  const sliceDecode = process.hrtime.bigint()

  const mappedIds = convertAllSlicingCriteriaToIds(slices as SlicingCriteria, decorated)
  // TODO: debugging output
  const sliceMapping = process.hrtime.bigint()

  const dataflow = produceDataFlowGraph(decorated)
  const dataflowCreation = process.hrtime.bigint()

  const sliced = staticSlicing(dataflow.graph, decorated.idMap, mappedIds.map(i => i.id))
  if(options.dataflow) {
    fs.writeFileSync(`${output}.dataflow`, graphToMermaid(dataflow.graph, decorated.idMap, undefined, undefined, sliced))
  }
  const sliceCreation = process.hrtime.bigint()

  const reconstructed = reconstructToCode<NoInfo>(decorated, sliced)
  const reconstruction = process.hrtime.bigint()

  log.info(`Writing slice to ${output}`)
  fs.writeFileSync(output, reconstructed)
  const sliceWrite = process.hrtime.bigint()

  return {
    astXmlRetrieval, astXmlNormalization, astDecoration, sliceDecode, sliceMapping, dataflowCreation, sliceCreation, reconstruction, sliceWrite
  }
}

function divWithRest(dividend: bigint, divisor: number): [bigint, bigint] {
  return [dividend / BigInt(divisor), dividend % BigInt(divisor)]
}

function formatNanoseconds(nanoseconds: bigint): string {
  if(nanoseconds < 0) {
    return `??`
  }
  const [seconds, rest] = divWithRest(nanoseconds, 1e9)
  const [milliseconds, remainingNanoseconds] = divWithRest(rest, 1e6)

  const secondsStr= seconds > 0 ? `${String(seconds).padStart(2, '0')}.` : ''
  const millisecondsStr = seconds > 0 ? `${String(milliseconds).padStart(3, '0')}:` : `${String(milliseconds)}:`
  const nanoStr = String(remainingNanoseconds).padEnd(3, '0').substring(0, 3)
  // TODO: round correctly?
  return `${secondsStr}${millisecondsStr}${nanoStr}`.padStart(10, ' ')
}

function getSlicesStats(tokenRetrieval: bigint, startTimeInNs: bigint, inputPrepare: bigint, slicingData: SlicingMeasurements | undefined, shellClose: bigint, sliceWrite: bigint) {
  let base = `Shell init time:        ${formatNanoseconds(startTimeInNs - shellInit)}
Retrieval of token map: ${formatNanoseconds(tokenRetrieval - startTimeInNs)}
Input preparation:      ${formatNanoseconds(inputPrepare - tokenRetrieval)}`
  if(slicingData !== undefined) {
    base += `
Slicing:                ${formatNanoseconds(slicingData.sliceWrite - inputPrepare)}
  AST retrieval:        ${formatNanoseconds(slicingData.astXmlRetrieval - inputPrepare)}
  AST normalization:    ${formatNanoseconds(slicingData.astXmlNormalization - slicingData.astXmlRetrieval)}
  AST decoration:       ${formatNanoseconds(slicingData.astDecoration - slicingData.astXmlNormalization)}
  Slice decoding:       ${formatNanoseconds(slicingData.sliceDecode - slicingData.astDecoration)}
  Slice mapping:        ${formatNanoseconds(slicingData.sliceMapping - slicingData.sliceDecode)}
  Dataflow creation:    ${formatNanoseconds(slicingData.dataflowCreation - slicingData.sliceMapping)}
  Slice creation:       ${formatNanoseconds(slicingData.sliceCreation - slicingData.dataflowCreation)}
  Reconstruction:       ${formatNanoseconds(slicingData.reconstruction - slicingData.sliceCreation)}
  Slice write:          ${formatNanoseconds(slicingData.sliceWrite - slicingData.reconstruction)}
`
  } else {
    base += '\nSlicing:                        ??\n'
  }
  base += `Shell close:            ${formatNanoseconds(shellClose - sliceWrite)}
Total:                  ${formatNanoseconds(shellClose - shellInit)}`
  return base
}

async function getSlice() {
  const startTimeInNs = process.hrtime.bigint()
  const tokens = await getStoredTokenMap(shell)
  const tokenRetrieval = process.hrtime.bigint()

  guard(options.input !== undefined, `input must be given`)
  const output = options.output ?? `${options.input}.slice`
  const request: RParseRequestFromFile = { request: 'file', content: options.input }
  const inputPrepare = process.hrtime.bigint()
  let slicingData: SlicingMeasurements | undefined
  try {
    slicingData = await writeSliceForSingleFile(request, tokens, output)
  } catch (e: unknown) {
    log.error(`[Skipped] Error while processing ${request.content}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
  }
  const sliceWrite = process.hrtime.bigint()
  shell.close()
  const shellClose = process.hrtime.bigint()
  const statsOutput = getSlicesStats(tokenRetrieval, startTimeInNs, inputPrepare, slicingData, shellClose, sliceWrite)
  console.log(statsOutput)
  if(options.stats) {
    const filename = `${options.input}.stats`
    console.log(`Writing stats for ${request.content} to "${filename}"`)
    fs.writeFileSync(filename, statsOutput)
  }
}

void getSlice()

