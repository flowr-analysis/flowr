import {
	SummarizedMeasurement,
	summarizedMeasurement2Csv,
	summarizedMeasurement2CsvHeader
} from '../../../../util/summarizer/benchmark/data'
import { MergeableRecord } from '../../../../util/objects'
import {
	appendCommonSyntaxTypeCounter,
	CommonSyntaxTypeCounts,
	emptyCommonSyntaxTypeCounts,
	summarizeCommonSyntaxTypeCounter
} from '../../common-syntax-probability'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'
import { FeatureStatisticsWithMeta } from '../../feature'
import { readLineByLineSync } from '../../../../util/files'
import path from 'path'
import { StatisticsOutputFormat } from '../../../output'
import fs from 'node:fs'
import { jsonReplacer } from '../../../../util/json'
import { date2string } from '../../../../util/time'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import { bigint2number } from '../../../../util/numbers'
import {
	AllDefinitionsFileBase,
	FunctionDefinitionInfo,
	SingleFunctionDefinitionInformation
} from './defined-functions'

// TODO: summarize all
interface FunctionDefinitionSummaryInformation<Measurement> {
	total:      Measurement,
	parameters: Measurement,
	length: {
		lines:              Measurement,
		chars:              Measurement,
		nonWhitespaceChars: Measurement
	},
	returns: {
		explicit:     Measurement
		implicit:     Measurement,
		onlyExplicit: Measurement,
		onlyImplicit: Measurement
	},
	exitPointsLinePercentageInDef: Measurement,
	linePercentageInFile:          Measurement,
	callsites:                     Measurement
}
// during the collection phase this should be a map using an array to collect
interface DefinedFunctionMetaPostProcessing<Measurement=SummarizedMeasurement> extends MergeableRecord {
	total:             Measurement
	lambdasOnly:       Measurement
	assignedFunctions: Measurement
	nestedFunctions:   Measurement
	recursive:         Measurement
	deepestNesting:    Measurement
}

function getFnDefCsv(idx: number | string, info: FunctionDefinitionSummaryInformation<number[][]>) {
	return `${JSON.stringify(idx)},${summarizedMeasurement2Csv(summarizeMeasurement(info.total.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.parameters.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.length.lines.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.length.chars.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.length.nonWhitespaceChars.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.returns.explicit.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.returns.implicit.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.returns.onlyExplicit.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.returns.onlyImplicit.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.exitPointsLinePercentageInDef.flat()))}`
		+ `,${summarizedMeasurement2Csv(summarizeMeasurement(info.linePercentageInFile.flat()))}\n`
}

/**
 * Note: the summary does not contain a 0 for each function that is _not_ called by a file. Hence, the minimum can not be 0 (division for mean etc. will still be performed on total file count)
 */
export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	// each number[][] contains a 'number[]' per file
	/**
	 * maps fn-name (including namespace) to several definition information
	 * we use tuples to reduce the memory!
	 */
	const definitionsPerFile: FunctionDefinitionSummaryInformation<number[][]>[] = []
	const mergedSuperDefinitions: FunctionDefinitionSummaryInformation<number[][]> = emptyFunctionDefinitionSummary()

	// we collect only `all-calls`
	readLineByLineSync(path.join(featureRoot, `${AllDefinitionsFileBase}.txt`), (line, lineNumber) => processNextLine(definitionsPerFile, lineNumber, info, JSON.parse(String(line)) as StatisticsOutputFormat<FunctionDefinitionInfo[]>, config))

	console.log(`    [${date2string(new Date())}] Defined functions process completed, start to write out function info`)

	const fnOutStream = fs.createWriteStream(path.join(outputPath, 'function-definitions.csv'))

	const prefixes = ['total', 'params','length-lines','length-chars','length-non-ws-chars', 'return-explicit', 'return-implicit', 'return-only-explicit', 'return-only-implicit', 'exit-points-line-crac', 'def-line-frac']
	const others = prefixes.flatMap(summarizedMeasurement2CsvHeader).join(',')
	fnOutStream.write(`counter,${others}\n`)
	for(const [idx, info] of definitionsPerFile.entries()) {
		fnOutStream.write(getFnDefCsv(idx, info))
		mergedSuperDefinitions.total.push(info.total.flat())
		mergedSuperDefinitions.parameters.push(info.parameters.flat())
		mergedSuperDefinitions.length.lines.push(info.length.lines.flat())
		mergedSuperDefinitions.length.chars.push(info.length.chars.flat())
		mergedSuperDefinitions.length.nonWhitespaceChars.push(info.length.nonWhitespaceChars.flat())
		mergedSuperDefinitions.returns.explicit.push(info.returns.explicit.flat())
		mergedSuperDefinitions.returns.implicit.push(info.returns.implicit.flat())
		mergedSuperDefinitions.returns.onlyExplicit.push(info.returns.onlyExplicit.flat())
		mergedSuperDefinitions.returns.onlyImplicit.push(info.returns.onlyImplicit.flat())
		mergedSuperDefinitions.exitPointsLinePercentageInDef.push(info.exitPointsLinePercentageInDef.flat())
		mergedSuperDefinitions.linePercentageInFile.push(info.linePercentageInFile.flat())
		mergedSuperDefinitions.callsites.push(info.callsites.flat())
	}
	// now, write the ultimate summary at the end of the file
	fnOutStream.write(getFnDefCsv('all', mergedSuperDefinitions))
	fnOutStream.close()
	// we do no longer need the given information!
	definitionsPerFile.length = 0


	console.log(`    [${date2string(new Date())}] Defined functions reading completed, summarizing info...`)

	const data: DefinedFunctionMetaPostProcessing<number[][]> = {
		averageCall:    [],
		nestedCalls:    [],
		deepestNesting: [],
		emptyArgs:      [],
		unnamedCalls:   [],
		args:           []
	}
	for(const meta of info.values()) {
		const us = meta.definedFunctions as FunctionDefinitionInfo
		data.averageCall.push([us.allFunctionCalls])
		data.nestedCalls.push([us.nestedFunctionCalls])
		data.deepestNesting.push([us.deepestNesting])
		data.emptyArgs.push([bigint2number(us.args[0] as bigint)])
		data.unnamedCalls.push([us.unnamedCalls])
		for(const [i, val] of Object.entries(us.args)) {
			if(Number(i) !== 0) {
				let get = data.args[Number(i)] as CommonSyntaxTypeCounts<number[][]> | undefined
				if(!get) {
					get = emptyCommonSyntaxTypeCounts(() => [])
					data.args[Number(i)] = get
				}
				appendCommonSyntaxTypeCounter(get, val as CommonSyntaxTypeCounts)
			}
		}
	}
	console.log(`    [${date2string(new Date())}] Defined functions metadata reading completed, summarizing and writing to file`)

	const summarizedEntries = {
		meta: {
			averageCall:    summarizeMeasurement(data.averageCall.flat(), info.size),
			nestedCalls:    summarizeMeasurement(data.nestedCalls.flat(), info.size),
			deepestNesting: summarizeMeasurement(data.deepestNesting.flat(), info.size),
			emptyArgs:      summarizeMeasurement(data.emptyArgs.flat(), info.size),
			unnamedCalls:   summarizeMeasurement(data.unnamedCalls.flat(), info.size),
			args:           data.args.map(summarizeCommonSyntaxTypeCounter)
		}
	}
	fs.writeFileSync(path.join(outputPath, 'function-calls.json'), JSON.stringify(summarizedEntries, jsonReplacer))
}

function emptyFunctionDefinitionSummary() {
	return {
		total:      [],
		parameters: [],
		length:     {
			lines:              [],
			chars:              [],
			nonWhitespaceChars: []
		},
		returns: {
			explicit:     [],
			implicit:     [],
			onlyExplicit: [],
			onlyImplicit: []
		},
		exitPointsLinePercentageInDef: [],
		linePercentageInFile:          [],
		callsites:                     []
	}
}

function processNextLine(data: FunctionDefinitionSummaryInformation<number[][]>[], lineNumber: number, info: Map<string, FeatureStatisticsWithMeta>, line: StatisticsOutputFormat<SingleFunctionDefinitionInformation[]>, config: StatisticsSummarizerConfiguration): void {
	if(lineNumber % 2_500 === 0) {
		console.log(`    [${date2string(new Date())}] Defined functions processed ${lineNumber} lines`)
	}
	const [hits, context] = line

	const forFile: FunctionDefinitionSummaryInformation<number[][]> = emptyFunctionDefinitionSummary()

	for(const { location, length, returns, numberOfParameters, callsites} of hits) {
		const stats = info.get(context ?? '')?.stats.lines[0].length

		// we retrieve the first component fo the path
		forFile.total.push([1])
		forFile.parameters.push([numberOfParameters])
		forFile.length.lines.push([length.lines])
		forFile.length.chars.push([length.characters])
		forFile.length.nonWhitespaceChars.push([length.nonWhitespaceCharacters])
		const explicits = returns.filter(r => r.explicit)
		forFile.returns.explicit.push([explicits.length])
		forFile.returns.implicit.push([returns.length - explicits.length])
		forFile.returns.onlyExplicit.push([explicits.length === returns.length ? 1 : 0])
		forFile.returns.onlyImplicit.push([explicits.length === 0 ? 1 : 0])
		forFile.exitPointsLinePercentageInDef.push(returns.map(r => r.location.line).map(l => l/length.lines))

		forFile.callsites.push([callsites.length])

		if(stats) {
			forFile.linePercentageInFile.push([location.line / stats])
		}
	}

	// push all of that to main :D
	data.push(forFile)
}
