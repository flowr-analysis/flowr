import {
	RShell,
	retrieveXmlFromRCode,
	RParseRequest,
	RParseRequestFromFile,
	RParseRequestFromText
} from '../r-bridge'
import { ALL_FEATURES, Feature, FeatureKey, FeatureSelection, FeatureStatistics } from './features'
import { DOMParser } from '@xmldom/xmldom'
import fs from 'fs'
import { log } from '../util/log'

const parser = new DOMParser()

export async function extractSingle(result: FeatureStatistics, shell: RShell, from: RParseRequest, features: 'all' | Set<FeatureKey>): Promise<FeatureStatistics> {
	const xml = await retrieveXmlFromRCode(from, shell)
	const doc = parser.parseFromString(xml, 'text/xml')

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	for(const [key, feature] of Object.entries(ALL_FEATURES) as [FeatureKey, Feature<any>][]) {
		if(features !== 'all' && !features.has(key)) {
			continue
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		result[key] = feature.process(result[key], doc, from.request === 'file' ? from.content : undefined)
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
		meta.lines.push(fs.readFileSync(request.content, 'utf-8').split('\n').map(l => l.length))
	}
}

export function staticRequests(...requests: (RParseRequestFromText | RParseRequestFromFile)[]): AsyncGenerator<RParseRequestFromText | RParseRequestFromFile> {
	// eslint-disable-next-line @typescript-eslint/require-await
	return async function* () {
		for(const request of requests) {
			yield request
		}
	}()
}

/**
 * extract all statistic information from a set of requests using the presented R session
 */
export async function extractUsageStatistics<T extends RParseRequestFromText | RParseRequestFromFile>(
	shell: RShell,
	onRequest: (request: T) => void,
	features: FeatureSelection,
	requests: AsyncGenerator<T>
): Promise<{ features: FeatureStatistics, meta: MetaStatistics }> {
	let result = {} as FeatureStatistics
	for(const key of Object.keys(ALL_FEATURES)) {
		result[key as FeatureKey] = ALL_FEATURES[key as FeatureKey].initialValue()
	}

	const meta = initialMetaStatistics()

	let first = true
	for await (const request of requests) {
		onRequest(request)
		const start = performance.now()
		try {
			result = await extractSingle(result, shell, {
				...request,
				attachSourceInformation: true,
				ensurePackageInstalled:  first
			}, features)
			processMetaOnSuccessful(meta, request)
			first = false
		} catch(e) {
			log.error('for request: ', request, e)
			meta.skipped.push(request.content)
		}
		meta.processingTimeMs.push(performance.now() - start)
	}
	return { features: result, meta }
}



