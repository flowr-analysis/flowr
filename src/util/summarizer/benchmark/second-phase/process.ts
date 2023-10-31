import { Reduction, SummarizedMeasurement, SummarizedSlicerStats, UltimateSlicerStats } from '../data'
import { DefaultMap } from '../../../defaultmap'
import {
	CommonSlicerMeasurements,
	PerSliceMeasurements,
	SlicerStatsDataflow,
	SlicerStatsInput,
	summarizeMeasurement,
	summarizeSummarizedMeasurement
} from '../../../../benchmark'
import { guard } from '../../../assert'

export function summarizeAllSummarizedStats(stats: SummarizedSlicerStats[]): UltimateSlicerStats {
	const commonMeasurements = new DefaultMap<CommonSlicerMeasurements, number[]>(() => [])
	const perSliceMeasurements = new DefaultMap<PerSliceMeasurements, SummarizedMeasurement[]>(() => [])
	const reductions: Reduction<SummarizedMeasurement>[] = []
	const inputs: SlicerStatsInput[] = []
	const dataflows: SlicerStatsDataflow[] = []
	let failedToRepParse = 0
	let timesHitThreshold = 0
	let totalSlices = 0

	for(const stat of stats) {
		for(const [k, v] of stat.commonMeasurements) {
			commonMeasurements.get(k).push(Number(v))
		}
		for(const [k, v] of stat.perSliceMeasurements.measurements) {
			perSliceMeasurements.get(k).push(v)
		}
		reductions.push(stat.perSliceMeasurements.reduction)
		inputs.push(stat.input)
		dataflows.push(stat.dataflow)
		failedToRepParse += stat.perSliceMeasurements.failedToRepParse
		totalSlices += stat.perSliceMeasurements.numberOfSlices
		timesHitThreshold += stat.perSliceMeasurements.timesHitThreshold
	}

	return {
		totalRequests:      stats.length,
		totalSlices:        totalSlices,
		commonMeasurements: new Map(
			[...commonMeasurements.entries()].map(([k, v]) => [k, summarizeMeasurement(v)])
		),
		perSliceMeasurements: new Map(
			[...perSliceMeasurements.entries()].map(([k, v]) => [k, summarizeSummarizedMeasurement(v)])
		),
		failedToRepParse,
		timesHitThreshold,
		reduction: {
			numberOfDataflowNodes:           summarizeSummarizedMeasurement(reductions.map(r => r.numberOfDataflowNodes)),
			numberOfLines:                   summarizeSummarizedMeasurement(reductions.map(r => r.numberOfLines)),
			numberOfCharacters:              summarizeSummarizedMeasurement(reductions.map(r => r.numberOfCharacters)),
			numberOfNonWhitespaceCharacters: summarizeSummarizedMeasurement(reductions.map(r => r.numberOfNonWhitespaceCharacters)),
			numberOfLinesNoAutoSelection:    summarizeSummarizedMeasurement(reductions.map(r => r.numberOfLinesNoAutoSelection)),
			numberOfNormalizedTokens:        summarizeSummarizedMeasurement(reductions.map(r => r.numberOfNormalizedTokens)),
			numberOfRTokens:                 summarizeSummarizedMeasurement(reductions.map(r => r.numberOfRTokens))
		},
		input: {
			numberOfLines:                   summarizeMeasurement(inputs.map(i => i.numberOfLines)),
			numberOfCharacters:              summarizeMeasurement(inputs.map(i => i.numberOfCharacters)),
			numberOfNonWhitespaceCharacters: summarizeMeasurement(inputs.map(i => i.numberOfNonWhitespaceCharacters)),
			numberOfRTokens:                 summarizeMeasurement(inputs.map(i => i.numberOfRTokens)),
			numberOfNormalizedTokens:        summarizeMeasurement(inputs.map(i => i.numberOfNormalizedTokens))
		},
		dataflow: {
			numberOfNodes:               summarizeMeasurement(dataflows.map(d => d.numberOfNodes)),
			numberOfFunctionDefinitions: summarizeMeasurement(dataflows.map(d => d.numberOfFunctionDefinitions)),
			numberOfCalls:               summarizeMeasurement(dataflows.map(d => d.numberOfCalls)),
			numberOfEdges:               summarizeMeasurement(dataflows.map(d => d.numberOfEdges))
		}
	}
}

export function processNextSummary(line: Buffer, allSummarized: SummarizedSlicerStats[]) {
	let got = JSON.parse(line.toString()) as { filename: string, summarize: SummarizedSlicerStats }
	got = {
		filename:  got.filename,
		summarize: {
			input:              got.summarize.input,
			request:            got.summarize.request,
			dataflow:           got.summarize.dataflow,
			commonMeasurements: new Map(
				(got.summarize.commonMeasurements as unknown as [CommonSlicerMeasurements, string][])
					.map(([k, v]) => {
						guard(v.endsWith('n'), 'Expected a bigint')
						return [k, BigInt(v.slice(0, -1))]
					})
			),
			perSliceMeasurements: {
				numberOfSlices:     got.summarize.perSliceMeasurements.numberOfSlices,
				sliceCriteriaSizes: got.summarize.perSliceMeasurements.sliceCriteriaSizes,
				measurements:
					new Map(got.summarize.perSliceMeasurements.measurements as unknown as [PerSliceMeasurements, SummarizedMeasurement][]),
				reduction:         got.summarize.perSliceMeasurements.reduction,
				timesHitThreshold: got.summarize.perSliceMeasurements.timesHitThreshold,
				failedToRepParse:  got.summarize.perSliceMeasurements.failedToRepParse,
				sliceSize:         got.summarize.perSliceMeasurements.sliceSize
			}
		}
	}
	allSummarized.push(got.summarize)
}

