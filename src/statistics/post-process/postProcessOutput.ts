import { ALL_FEATURES, FeatureKey, FeatureSelection } from '../features'
import path from 'path'
import { log } from '../../util/log'
import fs from 'fs'
import { ClusterContextIdMap, ClusterReport, clusterStatisticsOutput } from './clusterer'
import { ColorEffect, Colors, defaultStatisticsFileSuffix, FontWeights, formatter } from '../output'
import { deterministicCountingIdGenerator, IdType } from '../../r-bridge'
import { DefaultMap } from '../../util/defaultmap'

/**
 * Post process the collections in a given folder, reducing them in a memory preserving way.
 *
 * @param filepath - path to the root file of the data collection like `statistics-out/top-2023-01-01-00-00-00/`
 * @param features - collection of features to post process, expects corresponding folders to exist
 *
 * @returns non-aggregated reports for each sub-key of each feature
 */
export function postProcessFolder(filepath: string, features: FeatureSelection): ClusterReport[] {
  if(!fs.existsSync(filepath)) {
    log.warn(`Folder for ${filepath} does not exist, skipping post processing`)
    return []
  }

  const results: ClusterReport[] = []
  for(const feature of features) {
    const result = processFeatureFolder(filepath, feature)
    if(result.length > 0) {
      results.push(...result)
    }
  }
  return results
}

/**
 * process a single feature folder like `Assignments/`
 *
 * @param filepath - same as the input to {@link postProcessFolder}
 * @param feature - the single feature to process
 */
function processFeatureFolder(filepath: string, feature: FeatureKey): ClusterReport[] {
  const featureInfo = ALL_FEATURES[feature]
  const targetPath = path.join(filepath, featureInfo.name)

  if(!fs.existsSync(targetPath)) {
    log.warn(`Folder for ${feature} does not exist at ${targetPath} skipping post processing of this feature`)
    return []
  }
  log.info(`Processing ${feature} at ${targetPath}`)

  const contextIdMap: ClusterContextIdMap = new DefaultMap<string | undefined, IdType>(deterministicCountingIdGenerator())

  const featureSubKeys = Object.keys(featureInfo.initialValue())
  const reports: ClusterReport[] = []
  for(const subKey of featureSubKeys) {
    const value = processFeatureSubKey(targetPath, subKey, contextIdMap)
    if(value !== undefined) {
      reports.push(value)
    }
  }
  return reports
}

function processFeatureSubKey(featurePath: string, subKey: string, contextIdMap: ClusterContextIdMap): undefined | ClusterReport {
  const targetPath = path.join(featurePath, `${subKey}${defaultStatisticsFileSuffix}`)

  if(!fs.existsSync(targetPath)) {
    log.warn(`Folder for ${subKey} does not exist at ${targetPath} skipping post processing of this key`)
    return undefined
  }

  return clusterStatisticsOutput(targetPath, contextIdMap)
}

export function printClusterReport(report: ClusterReport) {
  console.log(`\n\n\n`)
  console.log(report.filepath)

  // TODO: violin plot by file
  const shortstats = [...report.valueInfoMap.entries()].map(([id, values]) => {
    return {
      id,
      count:  [...values.values()].reduce((a, b) => a + b, 0),
      unique: values.size()
    }
  }).sort((a, b) => b.count - a.count)
  const { longestId, longestCount, longestUnique } = shortstats.reduce((acc, {id, count, unique}) => {
    return {
      longestId:     Math.max(acc.longestId, id.length),
      longestCount:  Math.max(acc.longestCount, count.toLocaleString().length),
      longestUnique: Math.max(acc.longestUnique, unique.toLocaleString().length),
    }
  }, { longestId: 0, longestCount: 0, longestUnique: 0 })

  for(const {id, count, unique} of shortstats) {
    const strId = `${id}`.padEnd(longestId, ' ')
    const strCount = count.toLocaleString().padStart(longestCount, ' ')
    const strUnique = unique.toLocaleString().padStart(longestUnique, ' ')
    const uniqueSuffix = `\t (${strUnique} ${formatter.format('unique', { color: Colors.white, effect: ColorEffect.foreground })})`
    console.log(`\t${formatter.format(strId, { weight: FontWeights.bold })}\t ${strCount} ` +
      `${formatter.format('total', { color: Colors.white, effect: ColorEffect.foreground })}`
      + (count !== unique ? uniqueSuffix : '')
    )
  }
}
