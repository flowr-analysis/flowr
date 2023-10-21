import { FeatureStatisticsWithMeta } from '../../feature'
import { SummarizedMeasurement } from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import { CommentInfo } from './comments'
import { guard } from '../../../../util/assert'
import fs from 'node:fs'
import path from 'path'
import { jsonReplacer } from '../../../../util/json'


type CommentsPostProcessing<Measurement=SummarizedMeasurement> = MergeableRecord & {
	[K in keyof CommentInfo]: Measurement
}

// monoids would be helpful :c
function appendCommentsPostProcessing(a: CommentsPostProcessing<number[]>, b: CommentsPostProcessing<number>) {
	for(const [key, val] of Object.entries(b)) {
		const get = a[key] as number[] | undefined
		guard(get !== undefined, `key ${key} is not present in the comments post processing`)
		get.push(val as number)
	}
}

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string): void {
	const collected: CommentsPostProcessing<number[]> = {
		totalAmount:       [],
		roxygenComments:   [],
		import:            [],
		importFrom:        [],
		importMethodsFrom: [],
		importClassesFrom: [],
		useDynLib:         [],
		export:            [],
		exportClass:       [],
		exportMethod:      [],
		exportS3Method:    [],
		exportPattern:     []
	}
	for(const [,feature] of info.entries()) {
		appendCommentsPostProcessing(collected, feature.comments as CommentsPostProcessing<number>)
	}

	fs.writeFileSync(path.join(outputPath, 'comments.json'), JSON.stringify(collected, jsonReplacer))
}
