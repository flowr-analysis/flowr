import type { Reduction, SummarizedMeasurement, SummarizedSlicerStats, UltimateSlicerStats } from '../data'
import { DefaultMap } from '../../../defaultmap'
import type {
	SlicerStatsDataflow,
	SlicerStatsInput
} from '../../../../benchmark'
import {
	PerSliceMeasurements
	,
	CommonSlicerMeasurements
	,
	summarizeMeasurement,
	summarizeSummarizedMeasurement
} from '../../../../benchmark'


import { guard } from '../../../assert'
import { sum } from '../../../arrays'
import { summarizeReductions } from '../first-phase/process'

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
		reduction: summarizeReductions(reductions),
		input:     {
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

export function summarizeAllUltimateStats(stats: UltimateSlicerStats[]): UltimateSlicerStats {
	return {
		totalRequests:        sum(stats.map(s => s.totalRequests)),
		totalSlices:          sum(stats.map(s => s.totalSlices)),
		commonMeasurements:   new Map(CommonSlicerMeasurements.map(m => [m, summarizeSummarizedMeasurement(stats.map(s => s.commonMeasurements.get(m) as SummarizedMeasurement))])),
		perSliceMeasurements: new Map(PerSliceMeasurements.map(m => [m, summarizeSummarizedMeasurement(stats.map(s => s.perSliceMeasurements.get(m) as SummarizedMeasurement))])),
		failedToRepParse:     sum(stats.map(s => s.failedToRepParse)),
		timesHitThreshold:    sum(stats.map(s => s.timesHitThreshold)),
		reduction:            summarizeReductions(stats.map(s => s.reduction)),
		// input and dataflow don't change between files, so just pick the first ones
		input:                stats[0].input,
		dataflow:             stats[0].dataflow
	}
}

export function processNextSummary(line: Buffer, allSummarized: SummarizedSlicerStats[]): void {
	let got = JSON.parse(line.toString()) as { summarize: SummarizedSlicerStats }
	got = {
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
				measurements:       new Map(got.summarize.perSliceMeasurements.measurements as unknown as [PerSliceMeasurements, SummarizedMeasurement][]),
				reduction:          got.summarize.perSliceMeasurements.reduction,
				timesHitThreshold:  got.summarize.perSliceMeasurements.timesHitThreshold,
				failedToRepParse:   got.summarize.perSliceMeasurements.failedToRepParse,
				sliceSize:          got.summarize.perSliceMeasurements.sliceSize
			}
		}
	}
	allSummarized.push(got.summarize)
}

export function processNextUltimateSummary(line: Buffer, allSummarized: UltimateSlicerStats[]): void {
	let got = JSON.parse(line.toString()) as { summarize: UltimateSlicerStats }
	got = {
		summarize: {
			totalRequests:        got.summarize.totalRequests,
			totalSlices:          got.summarize.totalSlices,
			commonMeasurements:   new Map(got.summarize.commonMeasurements as unknown as [CommonSlicerMeasurements, SummarizedMeasurement][]),
			perSliceMeasurements: new Map(got.summarize.perSliceMeasurements as unknown as [PerSliceMeasurements, SummarizedMeasurement][]),
			failedToRepParse:     got.summarize.failedToRepParse,
			timesHitThreshold:    got.summarize.timesHitThreshold,
			reduction:            got.summarize.reduction,
			input:                got.summarize.input,
			dataflow:             got.summarize.dataflow,
		}
	}
	allSummarized.push(got.summarize)
}
