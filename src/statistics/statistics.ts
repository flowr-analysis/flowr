import {
  retrieveXmlFromRCode,
  RParseRequest,
  RParseRequestFromFile,
  RParseRequestFromText
} from '../r-bridge/retriever'
import { ALL_FEATURES, FeatureKey, FeatureStatistics, InitialFeatureStatistics } from './feature'
import { RShell } from '../r-bridge/shell'
import { DOMParser } from 'xmldom'
import fs from 'fs'

export async function extractSingle(result: FeatureStatistics, shell: RShell, from: RParseRequest, features: 'all' | Set<FeatureKey>): Promise<FeatureStatistics> {
  const xml = await retrieveXmlFromRCode(from, shell)
  const doc = new DOMParser().parseFromString(xml, 'text/xml')

  for (const [key, feature] of Object.entries(ALL_FEATURES)) {
    if(features !== 'all' && !features.has(key )) {
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    result[key] = feature.append(result[key], doc)
  }

  return result
}

export interface MetaStatistics {
  /**
   * the number of requests that were parsed successfully
   */
  successfulParsed: number
  /**
   * the processing time for each request
   */
  processingTimeMs: number[]
  /**
   * skipped requests
   */
  skipped:          string[]
  /**
   * number of lines with each individual line length consumed for each request
   */
  lines:            number[][]
}

const initialMetaStatistics: () => MetaStatistics = () => ({
  successfulParsed: 0,
  processingTimeMs: [],
  skipped:          [],
  lines:            []
})


function processMetaOnSuccessful<T extends RParseRequestFromText | RParseRequestFromFile>(meta: MetaStatistics, request: T) {
  meta.successfulParsed++
  if(request.request === 'text') {
    meta.lines.push(request.content.split('\n').map(l => l.length))
  } else {
    // TODO: separate between comment and non-comment lines?
    meta.lines.push(fs.readFileSync(request.content, 'utf-8').split('\n').map(l => l.length))
  }
}

/**
 * extract all statistic information from a set of requests using the presented R session
 */
export async function extract<T extends RParseRequestFromText | RParseRequestFromFile>(shell: RShell,
                                                                                       onRequest: (request: T) => void,
                                                                                       features: 'all' | Set<FeatureKey>,
                                                                                       ...requests: T[]
): Promise<{ features: FeatureStatistics, meta: MetaStatistics }> {
  let result = InitialFeatureStatistics()
  const meta = initialMetaStatistics()

  // TODO: allow to differentiate between testfolder and no testfolder
  let first = true
  for(const request of requests) {
    onRequest(request)
    processMetaOnSuccessful(meta, request)
    const start = performance.now()
    try {
      result = await extractSingle(result, shell, {
        ...request,
        attachSourceInformation: true,
        ensurePackageInstalled:  first
      }, features)
      first = false
    } catch (e) {
      console.error('for request: ', request, e)
      meta.skipped.push(request.content)
    }
    meta.processingTimeMs.push(performance.now() - start)
  }
  console.warn(`skipped ${meta.skipped.length} requests due to errors (run with logs to get more info)`)
  return { features: result, meta }
}



