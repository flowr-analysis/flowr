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
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'


type CommentsPostProcessing<Measurement=SummarizedMeasurement> = MergeableRecord & {
	[K in keyof CommentInfo]: Measurement
}

// monoids would be helpful :c
function appendCommentsPostProcessing(a: CommentsPostProcessing<CommentsMeta>, b: CommentsPostProcessing<number>, numberOfLines: number, filepath: string, skipForProjects: number) {
	for(const [key, val] of Object.entries(b)) {
		const get = a[key] as CommentsMeta | undefined
		guard(get !== undefined, `key ${key} is not present in the comments post processing`)
		get.count.push(val as number)
		get.fracOfLines.push(val as number / numberOfLines)
		if(val as number > 0) {
			get.uniqueFiles.add(filepath)
			console.log('x', filepath.split(path.sep)[skipForProjects] ?? '')
			get.uniqueProjects.add(filepath.split(path.sep)[skipForProjects] ?? '')
		}
	}
}

interface CommentsMeta {
	count:          number[]
	// how many lines are comments?
	fracOfLines:    number[]
	uniqueProjects: Set<string>
	uniqueFiles:    Set<string>
}
const initialCommentsMeta: () => CommentsMeta = () => ({ count: [], uniqueProjects: new Set(), uniqueFiles: new Set(), fracOfLines: [] })

function mapComments<In,Out>(data: CommentsPostProcessing<In>, fn: (input: In) => Out): CommentsPostProcessing<Out> {
	const collected = {} as unknown as CommentsPostProcessing<Out>
	for(const [key, value] of Object.entries(data)) {
		collected[key] = fn(value as In)
	}
	return collected
}

// TODO: collect dyn libs written?
export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	// for each we collect the count and the number of files that contain them
	const collected = mapComments(initialCommentInfo, initialCommentsMeta)

	for(const [filepath,feature] of info.entries()) {
		appendCommentsPostProcessing(collected, feature.comments as CommentsPostProcessing<number>, feature.stats.lines[0].length,filepath,config.projectSkip)
	}

	// create summarized measurements TODO: (we should have abstracted that away...)
	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'comments.csv'))
	fnOutStream.write(`kind,uniqueProjects,uniqueFiles,${summarizedMeasurement2CsvHeader('count')},${summarizedMeasurement2CsvHeader('frac-of-lines')}\n`)
	for(const [key, val] of Object.entries(collected)) {
		const { count, uniqueProjects, uniqueFiles, fracOfLines } = val as CommentsMeta
		const counts = summarizeMeasurement(count)
		const lineFrac = summarizeMeasurement(fracOfLines)
		fnOutStream.write(`${JSON.stringify(key)},${uniqueProjects.size},${uniqueFiles.size},${summarizedMeasurement2Csv(counts)},${summarizedMeasurement2Csv(lineFrac)}\n`)
	}
}
