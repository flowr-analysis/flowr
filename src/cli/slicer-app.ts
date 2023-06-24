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
import { naiveStaticSlicing } from '../slicing/static'
import { assert } from 'chai'
import { guard, isNotUndefined } from '../util/assert'
import { produceDataFlowGraph } from '../dataflow'
import { reconstructToCode } from '../slicing/reconstruct'
import { SlicingCriterion, slicingCriterionToId } from '../slicing/criteria'

export const toolName = 'slicer'

export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'input',        alias: 'i', type: String,  description: '(Required) Pass a single file to slice', multiple: false, defaultOption: true, typeLabel: '{underline files}' },
  { name: 'criterion',    alias: 'c', type: String,  description: '(Required) Slicing criterion either in the form {underline line:col} or {underline line@variable}, multiple can be separated by \'{bold ;}\'', multiple: false },
  { name: 'stats',        alias: 's', type: Boolean, description: `Print stats to {italic <output>.stats} (runtimes etc.)`, multiple: false },
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


function sliceAllCriteriaToIds(slices: SlicingCriterion[], decorated: DecoratedAst<ParentInformation>): NodeId[] {
  return slices.map(l => slicingCriterionToId(l, decorated)).map((d, i) => {
    assert(isNotUndefined(d), `all ids must be found, but not for id ${i}`)
    console.log(`Slicing for ${JSON.stringify(decorated.idMap.get(d)?.lexeme)} (loc: ${JSON.stringify(decorated.idMap.get(d)?.location)}, from: ${slices[i]})`)
    return d
  })
}

interface SlicingMeasurements {
  astRetrieval:     bigint,
  astDecoration:    bigint,
  sliceDecode:      bigint,
  sliceMapping:     bigint,
  dataflowCreation: bigint,
  sliceCreation:    bigint,
  reconstruction:   bigint,
  sliceWrite:       bigint
}

async function writeSliceForSingleFile(request: RParseRequestFromFile, tokens: Record<string, string>, output: string): Promise<SlicingMeasurements> {
  const ast = await retrieveAstFromRCode({
    ...request,
    attachSourceInformation: true,
    ensurePackageInstalled:  true
  }, tokens, shell)
  const astRetrieval = process.hrtime.bigint()

  guard(options.criterion !== undefined, `criterion must be given`)

  const decorated = decorateAst(ast)
  const astDecoration = process.hrtime.bigint()

  const slices = options.criterion.split(';').map(c => c.trim())
  const sliceDecode = process.hrtime.bigint()

  const mappedIds = sliceAllCriteriaToIds(slices as SlicingCriterion[], decorated)
  const sliceMapping = process.hrtime.bigint()

  const dataflow = produceDataFlowGraph(decorated)
  const dataflowCreation = process.hrtime.bigint()

  const sliced = naiveStaticSlicing(dataflow.graph, decorated.idMap, mappedIds)
  const sliceCreation = process.hrtime.bigint()

  const reconstructed = reconstructToCode<NoInfo>(decorated, sliced)
  const reconstruction = process.hrtime.bigint()

  log.info(`Writing slice to ${output}`)
  fs.writeFileSync(output, reconstructed)
  const sliceWrite = process.hrtime.bigint()

  return {
    astRetrieval, astDecoration, sliceDecode, sliceMapping, dataflowCreation, sliceCreation, reconstruction, sliceWrite
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
Slicing:
  AST retrieval:        ${formatNanoseconds(slicingData.astRetrieval - inputPrepare)}
  AST decoration:       ${formatNanoseconds(slicingData.astDecoration - slicingData.astRetrieval)}
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

