import {
  retrieveXmlFromRCode,
  RParseRequest,
  RParseRequestFromFile,
  RParseRequestFromText
} from '../r-bridge/retriever'
import { ALL_FEATURES, FeatureStatistics, InitialFeatureStatistics } from './feature'
import { RShell } from '../r-bridge/shell'
import { DOMParser } from 'xmldom'

export async function extractSingle(result: FeatureStatistics, shell: RShell, from: RParseRequest): Promise<FeatureStatistics> {
  const xml = await retrieveXmlFromRCode(from, shell)
  const doc = new DOMParser().parseFromString(xml, 'text/xml')

  for (const [key, feature] of Object.entries(ALL_FEATURES)) {
    // eslint-disable-nex-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error object.entries does not retain the type information
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    result[key] = feature.append(result[key], doc)
  }

  return result
}

/**
 * extract all statistic information from a set of requests using the presented R session
 */
export async function extract<T extends RParseRequestFromText | RParseRequestFromFile>(shell: RShell,
                                                                                       onRequest: (request: T) => void,
                                                                                       ...requests: T[]
): Promise<FeatureStatistics> {
  let result = InitialFeatureStatistics()
  let first = true
  for(const request of requests) {
    onRequest(request)
    result = await extractSingle(result, shell, { ...request, attachSourceInformation: true, ensurePackageInstalled: first })
    first = false
  }

  return result
}



