import { FeatureStatisticsWithMeta } from '../../feature'
import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import { CommentInfo, initialCommentInfo } from './comments'
import { guard } from '../../../../util/assert'
import fs from 'node:fs'
import path from 'path'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'


type CommentsPostProcessing<Measurement=SummarizedMeasurement> = MergeableRecord & {
	[K in keyof CommentInfo]: Measurement
}

// monoids would be helpful :c
function appendCommentsPostProcessing(a: CommentsPostProcessing<CommentsMeta>, b: CommentsPostProcessing<number>, filepath: string) {
	for(const [key, val] of Object.entries(b)) {
		const get = a[key] as CommentsMeta | undefined
		guard(get !== undefined, `key ${key} is not present in the comments post processing`)
		get.count.push(val as number)
		if(val as number > 0) {
			get.uniqueFiles.add(filepath)
		}
	}
}

interface CommentsMeta {
	count:       number[]
	uniqueFiles: Set<string>
}
const initialCommentsMeta: () => CommentsMeta = () => ({ count: [], uniqueFiles: new Set() })

function mapComments<In,Out>(data: CommentsPostProcessing<In>, fn: (input: In) => Out): CommentsPostProcessing<Out> {
	const collected = {} as unknown as CommentsPostProcessing<Out>
	for(const [key, value] of Object.entries(data)) {
		collected[key] = fn(value as In)
	}
	return collected
}

// TODO: collect dyn libs written?
export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string): void {
	// for each we collect the count and the number of files that contain them
	const collected = mapComments(initialCommentInfo, initialCommentsMeta)

	for(const [filepath,feature] of info.entries()) {
		appendCommentsPostProcessing(collected, feature.comments as CommentsPostProcessing<number>, filepath)
	}

	// create summarized measurements TODO: (we should have abstracted that away...)
	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'comments.csv'))
	fnOutStream.write(`kind,${summarizedMeasurement2CsvHeader()},uniqueFiles
`)
	for(const [key, val] of Object.entries(collected)) {
		const { count, uniqueFiles } = val as CommentsMeta
		const measurement = summarizeMeasurement(count)
		fnOutStream.write(`${JSON.stringify(key)},${summarizedMeasurement2Csv(measurement)},${uniqueFiles.size}\n`)
	}
}
