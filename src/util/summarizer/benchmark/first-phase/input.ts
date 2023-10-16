import {
	CommonSlicerMeasurements, PerSliceMeasurements,
	PerSliceStats,
	SlicerStats,
	stats2string,
	summarizeSlicerStats
} from '../../../../benchmark'
import { guard } from '../../../assert'
import { SlicingCriteria } from '../../../../slicing'
import { escape } from '../../../../statistics'
import fs from 'fs'
import { jsonReplacer } from '../../../json'

interface BenchmarkData {
	filename: string,
	stats:    SlicerStats
}


// TODO: use summarizer for loggign everywhere
export async function processNestMeasurement(line: Buffer, counter: number, summarizedText: string, outputPath: string) {
	let got = JSON.parse(line.toString()) as BenchmarkData
	console.log(`[${++counter}] Summarize for ${got.filename}`)
	// now we have to recover the maps and bigints :C
	got = {
		filename: got.filename,
		stats:    {
			input:              got.stats.input,
			request:            got.stats.request,
			dataflow:           got.stats.dataflow,
			commonMeasurements: new Map(
				(got.stats.commonMeasurements as unknown as [CommonSlicerMeasurements, string][])
					.map(([k, v]) => {
						guard(v.endsWith('n'), 'Expected a bigint')
						return [k, BigInt(v.slice(0, -1))]
					})
			),
			perSliceMeasurements: new Map(
				(got.stats.perSliceMeasurements as unknown as [SlicingCriteria, PerSliceStats][])
					.map(([k, v]) => mapPerSliceStats(k, v))
			)
		}
	}

	const totalSlices = got.stats.perSliceMeasurements.size
	console.log(`Summarizing ${totalSlices} slices...`)
	let atSliceNumber = 0
	const summarized = await summarizeSlicerStats(got.stats, (criterion, stats) => {
		console.log(`${escape}1F${escape}1G${escape}2K    [${++atSliceNumber}/${totalSlices}] Summarizing ${JSON.stringify(criterion)} (reconstructed has ${stats.reconstructedCode.code.length} characters)`)
	})

	console.log(`    - Append raw summary to ${outputPath}`)
	fs.appendFileSync(outputPath, `${JSON.stringify({
		filename:  got.filename,
		summarize: summarized
	}, jsonReplacer)}\n`)

	console.log(`    - Append textual summary to ${summarizedText}`)
	fs.appendFileSync(summarizedText, `${stats2string(summarized)}\n`)
}

function mapPerSliceStats(k: SlicingCriteria, v: PerSliceStats): [SlicingCriteria, PerSliceStats] {
	return [k, {
		reconstructedCode: v.reconstructedCode,
		slicingCriteria:   v.slicingCriteria,
		timesHitThreshold: v.timesHitThreshold,
		measurements:      new Map(
			(v.measurements as unknown as [PerSliceMeasurements, string][])
				.map(([k, v]) => {
					guard(v.endsWith('n'), 'Expected a bigint')
					return [k, BigInt(v.slice(0, -1))]
				})
		),
		numberOfDataflowNodesSliced: v.numberOfDataflowNodesSliced
	}]
}
