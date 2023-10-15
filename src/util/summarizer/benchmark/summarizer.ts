/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import {
	CommonSlicerMeasurements,
	PerSliceMeasurements,
	PerSliceStats,
	SlicerStats,
	SlicerStatsDataflow,
	SlicerStatsInput
} from '../../../benchmark/stats/stats'
import { DefaultMap } from '../../defaultmap'
import {
	retrieveNormalizedAstFromRCode,
	retrieveNumberOfRTokensOfLastParse,
	RShell,
	visitAst
} from '../../../r-bridge'
import { SlicingCriteria } from '../../../slicing'
import * as tmp from 'tmp'
import fs from 'fs'
import { isNotUndefined } from '../../assert'
import { log } from '../../log'

let _tempfile: tmp.FileResult | undefined = undefined
function tempfile() {
	if(_tempfile === undefined) {
		_tempfile = tmp.fileSync({ postfix: '.R', keep: false })
		process.on('beforeExit', () => _tempfile?.removeCallback())
	}
	return _tempfile
}

export interface SummarizedMeasurement {
	min:    number
	max:    number
	median: number
	/** average */
	mean:   number
	/** standard deviation */
	std:    number
}

interface SliceSizeCollection {
	lines:                   number[]
	characters:              number[]
	nonWhitespaceCharacters: number[]
	/** like library statements during reconstruction */
	autoSelected:            number[]
	dataflowNodes:           number[]
	tokens:                  number[]
	normalizedTokens:        number[]
}

/**
 * @see SlicerStats
 * @see summarizeSlicerStats
 */
export type SummarizedSlicerStats = {
	perSliceMeasurements: SummarizedPerSliceStats
} & Omit<SlicerStats, 'perSliceMeasurements'>

export interface Reduction<T = number> {
	numberOfLines:                   T
	numberOfLinesNoAutoSelection:    T
	numberOfCharacters:              T
	numberOfNonWhitespaceCharacters: T
	numberOfRTokens:                 T
	numberOfNormalizedTokens:        T
	numberOfDataflowNodes:           T
}

export interface SummarizedPerSliceStats {
	/** number of total slicing calls */
	numberOfSlices:     number
	/** statistics on the used slicing criteria (number of ids within criteria etc.) */
	sliceCriteriaSizes: SummarizedMeasurement
	measurements:       Map<PerSliceMeasurements, SummarizedMeasurement>
	reduction:          Reduction<SummarizedMeasurement>
	failedToRepParse:   number
	timesHitThreshold:  number
	sliceSize:          {
		[K in keyof SliceSizeCollection]: SummarizedMeasurement
	}
}

function safeDivPercentage(a: number, b: number): number | undefined{
	if(isNaN(a) || isNaN(b)) {
		return undefined
	} else if(b === 0) {
		return a === 0 ? 0 : undefined
	} else {
		const result = 1 - (a / b)
		if(isNaN(result)) {
			log.error(`NaN for ${a} and ${b}\n`)
			return undefined
		} else {
			return result
		}
	}
}

function calculateReductionForSlice(input: SlicerStatsInput, dataflow: SlicerStatsDataflow, perSlice: {
	[k in keyof SliceSizeCollection]: number
}): Reduction<number | undefined> {
	return {
		numberOfLines:                   safeDivPercentage(perSlice.lines, input.numberOfLines),
		numberOfLinesNoAutoSelection:    safeDivPercentage(perSlice.lines - perSlice.autoSelected, input.numberOfLines),
		numberOfCharacters:              safeDivPercentage(perSlice.characters, input.numberOfCharacters),
		numberOfNonWhitespaceCharacters: safeDivPercentage(perSlice.nonWhitespaceCharacters, input.numberOfNonWhitespaceCharacters),
		numberOfRTokens:                 safeDivPercentage(perSlice.tokens, input.numberOfRTokens),
		numberOfNormalizedTokens:        safeDivPercentage(perSlice.normalizedTokens, input.numberOfNormalizedTokens),
		numberOfDataflowNodes:           safeDivPercentage(perSlice.dataflowNodes, dataflow.numberOfNodes)
	}
}

export function withoutWhitespace(output: string): string {
	return output.replace(/\s/g,'')
}


/**
 * Summarizes the given stats by calculating the min, max, median, mean, and the standard deviation for each measurement.
 * @see Slicer
 */
export async function summarizeSlicerStats(stats: SlicerStats, report: (criteria: SlicingCriteria, stats: PerSliceStats) => void = () => { /* do nothing */ }): Promise<Readonly<SummarizedSlicerStats>> {
	const perSliceStats = stats.perSliceMeasurements

	const collect = new DefaultMap<PerSliceMeasurements, number[]>(() => [])
	const sizeOfSliceCriteria: number[] = []
	const reParseShellSession = new RShell()
	reParseShellSession.tryToInjectHomeLibPath()

	const reductions: Reduction<number | undefined>[] = []

	let failedOutputs = 0

	const sliceSize: SliceSizeCollection = {
		lines:                   [],
		autoSelected:            [],
		characters:              [],
		nonWhitespaceCharacters: [],
		tokens:                  [],
		normalizedTokens:        [],
		dataflowNodes:           []
	}

	let first = true
	let timesHitThreshold = 0
	for(const [criteria, perSliceStat] of perSliceStats) {
		report(criteria, perSliceStat)
		for(const measure of perSliceStat.measurements) {
			collect.get(measure[0]).push(Number(measure[1]))
		}
		sizeOfSliceCriteria.push(perSliceStat.slicingCriteria.length)
		timesHitThreshold += perSliceStat.timesHitThreshold > 0 ? 1 : 0
		const { code: output, autoSelected } = perSliceStat.reconstructedCode
		sliceSize.autoSelected.push(autoSelected)
		const lines = output.split('\n').length
		sliceSize.lines.push(lines)
		sliceSize.characters.push(output.length)
		const nonWhitespace = withoutWhitespace(output).length
		sliceSize.nonWhitespaceCharacters.push(nonWhitespace)
		// reparse the output to get the number of tokens
		try {
			// there seem to be encoding issues, therefore, we dump to a temp file
			fs.writeFileSync(tempfile().name, output)
			const reParsed = await retrieveNormalizedAstFromRCode(
				{ request: 'file', content: tempfile().name, ensurePackageInstalled: first },
				reParseShellSession
			)
			first = false
			let numberOfNormalizedTokens = 0
			visitAst(reParsed.ast, _ => {
				numberOfNormalizedTokens++
				return false
			})
			sliceSize.normalizedTokens.push(numberOfNormalizedTokens)

			const numberOfRTokens = await retrieveNumberOfRTokensOfLastParse(reParseShellSession)
			sliceSize.tokens.push(numberOfRTokens)

			reductions.push(calculateReductionForSlice(stats.input, stats.dataflow, {
				lines:                   lines,
				characters:              output.length,
				nonWhitespaceCharacters: nonWhitespace,
				autoSelected:            autoSelected,
				tokens:                  numberOfRTokens,
				normalizedTokens:        numberOfNormalizedTokens,
				dataflowNodes:           perSliceStat.numberOfDataflowNodesSliced
			}))
		} catch(e: unknown) {
			console.error(`    ! Failed to re-parse the output of the slicer for ${JSON.stringify(criteria)}`) //, e
			console.error(`      Code: ${output}\n`)
			failedOutputs++
		}

		sliceSize.dataflowNodes.push(perSliceStat.numberOfDataflowNodesSliced)
	}

	// summarize all measurements:
	const summarized = new Map<PerSliceMeasurements, SummarizedMeasurement>()
	for(const [criterion, measurements] of collect.entries()) {
		summarized.set(criterion, summarizeMeasurement(measurements))
	}

	reParseShellSession.close()

	return {
		...stats,
		perSliceMeasurements: {
			numberOfSlices:     perSliceStats.size,
			sliceCriteriaSizes: summarizeMeasurement(sizeOfSliceCriteria),
			measurements:       summarized,
			failedToRepParse:   failedOutputs,
			timesHitThreshold,
			reduction:          {
				numberOfLines:                   summarizeMeasurement(reductions.map(r => r.numberOfLines).filter(isNotUndefined)),
				numberOfLinesNoAutoSelection:    summarizeMeasurement(reductions.map(r => r.numberOfLinesNoAutoSelection).filter(isNotUndefined)),
				numberOfCharacters:              summarizeMeasurement(reductions.map(r => r.numberOfCharacters).filter(isNotUndefined)),
				numberOfNonWhitespaceCharacters: summarizeMeasurement(reductions.map(r => r.numberOfNonWhitespaceCharacters).filter(isNotUndefined)),
				numberOfRTokens:                 summarizeMeasurement(reductions.map(r => r.numberOfRTokens).filter(isNotUndefined)),
				numberOfNormalizedTokens:        summarizeMeasurement(reductions.map(r => r.numberOfNormalizedTokens).filter(isNotUndefined)),
				numberOfDataflowNodes:           summarizeMeasurement(reductions.map(r => r.numberOfDataflowNodes).filter(isNotUndefined))
			},
			sliceSize: {
				lines:                   summarizeMeasurement(sliceSize.lines),
				characters:              summarizeMeasurement(sliceSize.characters),
				nonWhitespaceCharacters: summarizeMeasurement(sliceSize.nonWhitespaceCharacters),
				autoSelected:            summarizeMeasurement(sliceSize.autoSelected),
				tokens:                  summarizeMeasurement(sliceSize.tokens),
				normalizedTokens:        summarizeMeasurement(sliceSize.normalizedTokens),
				dataflowNodes:           summarizeMeasurement(sliceSize.dataflowNodes)
			}
		}
	}
}

export function summarizeMeasurement(data: number[]): SummarizedMeasurement {
	// just to avoid in-place modification
	const sorted = [...data].sort((a, b) => a - b)
	const min = sorted[0]
	const max = sorted[sorted.length - 1]
	const median = sorted[Math.floor(sorted.length / 2)]
	const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
	// sqrt(sum(x-mean)^2 / n)
	const std = Math.sqrt(sorted.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / sorted.length)
	return { min, max, median, mean, std }
}

export function summarizeSummarizedMeasurement(data: SummarizedMeasurement[]): SummarizedMeasurement {
	const min = data.map(d => d.min).filter(isNotUndefined).reduce((a, b) => Math.min(a, b), Infinity)
	const max = data.map(d => d.max).filter(isNotUndefined).reduce((a, b) => Math.max(a, b), -Infinity)
	// get most average
	const median = data.map(d => d.median).filter(isNotUndefined).reduce((a, b) => a + b, 0) / data.length
	const mean = data.map(d => d.mean).filter(isNotUndefined).reduce((a, b) => a + b, 0) / data.length
	// Method 1 of https://www.statology.org/averaging-standard-deviations/
	const std = Math.sqrt(data.map(d => d.std ** 2).filter(isNotUndefined).reduce((a, b) => a + b, 0) / data.length)
	return { min, max, median, mean, std }
}


export interface UltimateSlicerStats {
	totalRequests:        number
	totalSlices:          number
	commonMeasurements:   Map<CommonSlicerMeasurements, SummarizedMeasurement>
	perSliceMeasurements: Map<PerSliceMeasurements, SummarizedMeasurement>
	/** sum */
	failedToRepParse:     number
	/** sum */
	timesHitThreshold:    number
	reduction:            Reduction<SummarizedMeasurement>
	input:                SlicerStatsInput<SummarizedMeasurement>
	dataflow:             SlicerStatsDataflow<SummarizedMeasurement>
}

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
			numberOfRTokens:                 summarizeSummarizedMeasurement(reductions.map(r => r.numberOfRTokens)),
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
