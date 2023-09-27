import { retrieveXmlFromRCode, RParseRequest, RParseRequestFromFile, RParseRequestFromText, RShell } from '../r-bridge'
import { ALL_FEATURES, Feature, FeatureKey, FeatureSelection, FeatureStatistics } from './features'
import { DOMParser } from '@xmldom/xmldom'
import fs from 'fs'
import { log } from '../util/log'
import { initialMetaStatistics, MetaStatistics } from './meta-statistics'

/**
 * By default, {@link extractUsageStatistics} requires a generator, but sometimes you already know all the files
 * that you want to process. This function simply reps your requests as a generator.
 */
export function staticRequests(...requests: (RParseRequestFromText | RParseRequestFromFile)[]): AsyncGenerator<RParseRequestFromText | RParseRequestFromFile> {
	// eslint-disable-next-line @typescript-eslint/require-await
	return async function* () {
		for(const request of requests) {
			yield request
		}
	}()
}

/**
 * Extract all wanted statistic information from a set of requests using the presented R session.
 *
 * @param shell     - The R session to use
 * @param onRequest - A callback that is called at the beginning of each request, this may be used to debug the requests.
 * @param features  - The features to extract, if `all` is passed, all available features are extracted.
 * @param requests  - The requests to extract the features from. May generate them on demand (e.g., by traversing a folder).
 * 										If your request is statically known, you can use {@link staticRequests} to create this generator.
 */
export async function extractUsageStatistics<T extends RParseRequestFromText | RParseRequestFromFile>(
	shell: RShell,
	onRequest: (request: T) => void,
	features: FeatureSelection,
	requests: AsyncGenerator<T>
): Promise<{ features: FeatureStatistics, meta: MetaStatistics }> {
	let result = initializeFeatureStatistics(features)
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
			processMetaOnUnsuccessful(meta, request)
		}
		meta.processingTimeMs.push(performance.now() - start)
	}
	return { features: result, meta }
}

function initializeFeatureStatistics(features: FeatureSelection): FeatureStatistics {
	let result = {} as FeatureStatistics
	for (const key of Object.keys(features)) {
		result[key as FeatureKey] = ALL_FEATURES[key as FeatureKey].initialValue()
	}
	return result
}

function processMetaOnUnsuccessful<T extends RParseRequestFromText | RParseRequestFromFile>(meta: MetaStatistics, request: T) {
	meta.skipped.push(request.content)
}

function processMetaOnSuccessful<T extends RParseRequestFromText | RParseRequestFromFile>(meta: MetaStatistics, request: T) {
	meta.successfulParsed++
	if(request.request === 'text') {
		meta.lines.push(request.content.split('\n').map(l => l.length))
	} else {
		meta.lines.push(fs.readFileSync(request.content, 'utf-8').split('\n').map(l => l.length))
	}
}


const parser = new DOMParser()

async function extractSingle(result: FeatureStatistics, shell: RShell, from: RParseRequest, features: 'all' | Set<FeatureKey>): Promise<FeatureStatistics> {
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
