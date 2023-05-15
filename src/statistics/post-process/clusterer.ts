/**
 * Reading the given file line by line and expecting constructs of {@link StatisticsOutputFormat},
 * this module is responsible for identifying interesting groups of same data.
 *
 * @module
 */
import { FeatureKey } from '../features'
import LineByLine from 'n-readlines'
import { StatisticsOutputFormat } from '../output'
import { DefaultMap } from '../../util/defaultmap'
import { deterministicCountingIdGenerator, IdType } from '../../r-bridge'
import fs from 'fs'

type ContextsWithCount = DefaultMap<IdType, number>
export function clusterStatisticsOutput(filepath: string): void {
  const lineReader = new LineByLine(filepath)

  // as we do not want to store the same context multiple time, we assign each of them a unique id.
  // undefined is used for unknown contexts
  const contextIdMap = new DefaultMap<string | undefined, IdType>(deterministicCountingIdGenerator())
  // for each value we store the context ids it was seen in (may list the same context multiple times if more often) - this serves as a counter as well
  const valueInfoMap = new DefaultMap<string, ContextsWithCount>(() => new DefaultMap(() => 0))
  let line
  // eslint-disable-next-line no-cond-assign
  while (line = lineReader.next()) {
    const json = JSON.parse(line.toString()) as StatisticsOutputFormat
    const contextId = contextIdMap.get(json.context)
    if(contextId === '7162' || contextId === '7163')
      console.log(json.context)
    const value = valueInfoMap.get(json.value)
    // step the counter accordingly
    value.set(contextId, value.get(contextId) + 1)
  }

  // TODO: outsource and clean up :C
  console.log(`# ${filepath}:`)
  console.log(`# ${contextIdMap.size()} different contexts`)
  for (const [value, info] of valueInfoMap.entries()) {
    console.log(`# ${value}: ${[...info.values()].reduce((a, b) => a + b, 0)} times in ${info.size()} different contexts`)
  }
  console.log("\n\n\n")

  console.log(`writing to ${filepath}.dat`)
  const fileHandle = fs.openSync(`${filepath}.dat`, 'w')
  const contexts = [...valueInfoMap.values()]
  // write the header
  fs.writeSync(fileHandle, [...valueInfoMap.keys()].map(k => `"${k}"`).join('\t') + '\n')
  // for each id we write a line of all found values and their corresponding value
  for(const id of contextIdMap.values()) {
    const info = contexts.map(c => `${c.get(id)}`)
    fs.writeSync(fileHandle, info.join('\t') + '\n')
  }
  fs.closeSync(fileHandle)
}
