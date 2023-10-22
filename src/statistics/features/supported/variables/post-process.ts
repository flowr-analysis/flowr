import { FeatureStatisticsWithMeta } from '../../feature'
import { StatisticsSummarizerConfiguration } from '../../../../util/summarizer/statistics/summarizer'
import {
	emptySummarizedWithProject,
	recordFilePath,
	ReplaceKeysForSummary,
	SummarizedWithProject
} from '../../post-processing'
import { DefinedVariableInformation, VariableInfo } from './variables'
import fs from 'node:fs'
import path from 'path'
import { summarizedMeasurement2Csv, summarizedMeasurement2CsvHeader } from '../../../../util/summarizer/benchmark/data'
import { summarizeMeasurement } from '../../../../util/summarizer/benchmark/first-phase/process'
import { readLineByLineSync } from '../../../../util/files'

type VariablesPostProcessing = ReplaceKeysForSummary<VariableInfo, SummarizedWithProject>

export function postProcess(featureRoot: string, info: Map<string, FeatureStatisticsWithMeta>, outputPath: string, config: StatisticsSummarizerConfiguration): void {
	const collected = {} as unknown as VariablesPostProcessing
	// TODO: outsource this
	for(const [filepath, data] of info.entries()) {
		const value = data.variables as VariableInfo
		for(const [key, val] of Object.entries(value)) {
			let get = collected[key] as SummarizedWithProject | undefined
			if(!get) {
				get = emptySummarizedWithProject()
				collected[key] = get
			}
			get.count.push(val)
			if(val > 0) {
				recordFilePath(get, filepath, config)
			}
		}
	}

	// TODO: abstract away these duplicates?
	const variablesOutStream = fs.createWriteStream(path.join(outputPath, 'variable-counts.csv'))
	variablesOutStream.write(`kind,unique-projects,unique-files,${summarizedMeasurement2CsvHeader()}\n`)

	for(const [key, val] of Object.entries(collected)) {
		if(key === 'unknownVariables') {
			// they are for function calls etc and in hindsight not a good idea
			continue
		}
		const data = val as SummarizedWithProject
		const sum = summarizeMeasurement(data.count)
		variablesOutStream.write(`${JSON.stringify(key)},${data.uniqueProjects.size},${data.uniqueFiles.size},${summarizedMeasurement2Csv(sum)}\n`)
	}
	variablesOutStream.close()

	const used = collectVariableInfoFor(path.join(featureRoot, 'usedVariables.txt'), info, config)
	writeVariableInfoToCsv(outputPath, 'used-variables.csv', used)
	const defined = collectVariableInfoFor(path.join(featureRoot, 'definedVariables.txt'), info, config)
	writeVariableInfoToCsv(outputPath, 'defined-variables.csv', defined)
	const redefined = collectVariableInfoFor(path.join(featureRoot, 'redefinedVariables.txt'), info, config)
	writeVariableInfoToCsv(outputPath, 'redefined-variables.csv', redefined)
}

type VariableInfoMap = Map<string, SummarizedWithProject & { linePercentageInFile: number[][] }>

export function writeVariableInfoToCsv(outputPath: string, filename: `${string}.csv`, data: VariableInfoMap): void {
	const out = fs.createWriteStream(path.join(outputPath, filename))
	out.write(`variable,unique-projects,unique-files,${summarizedMeasurement2CsvHeader('count')},${summarizedMeasurement2CsvHeader('line-frac')}\n`)
	for(const [key, val] of data.entries()) {
		const { count, uniqueProjects, uniqueFiles, linePercentageInFile } = val
		const counts = summarizeMeasurement(count)
		const lineFrac = summarizeMeasurement(linePercentageInFile.flat())
		out.write(`${JSON.stringify(key)},${uniqueProjects.size},${uniqueFiles.size},${summarizedMeasurement2Csv(counts)},${summarizedMeasurement2Csv(lineFrac)}\n`)
	}
	out.close()
}

function collectVariableInfoFor(filepath: string, info: Map<string, FeatureStatisticsWithMeta>, config: StatisticsSummarizerConfiguration): VariableInfoMap {
	// variable name to summary
	const collected = new Map<string, SummarizedWithProject & { linePercentageInFile: number[][] }>()

	readLineByLineSync(filepath, (line, lineNumber) => {
		if(line.length === 0) {
			return
		}
		if(lineNumber % 2_500 === 0) {
			console.log(`    Processed ${lineNumber} lines of ${filepath}`)
		}
		const [vars, context] = JSON.parse(line.toString()) as [DefinedVariableInformation[], string]
		const numberOfLines = info.get(context as string | undefined ?? '')?.stats.lines[0].length

		// first we have to collect what this file gives us
		const perFile = new Map<string, SummarizedWithProject & { linePercentageInFile: number[] }>()
		for(const [name, [line]] of vars) {
			let get = perFile.get(name)
			if(!get) {
				get = { ... emptySummarizedWithProject(), linePercentageInFile: [] }
				perFile.set(name, get)
			}
			get.count.push(1)
			if(numberOfLines) {
				get.linePercentageInFile.push(line / numberOfLines)
			}
		}

		// now we merge it into the global map (oh gosh this is so horrible
		for(const [name, data] of perFile.entries()) {
			let get = collected.get(name)
			if(!get) {
				get = { ... emptySummarizedWithProject(), linePercentageInFile: [] }
				collected.set(name, get)
			}
			get.count.push(data.count.length)
			get.linePercentageInFile.push(data.linePercentageInFile)
			if(data.count.length > 0) {
				recordFilePath(get, context, config)
			}
		}
	})

	return collected
}
