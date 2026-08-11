import type { UltimateSlicerStats } from '../data';
import fs from 'fs';
import type { MergeableRecord } from '../../../util/objects';
import { jsonReplacer } from '../../../util/json';
import type { SummarizedMeasurement } from '../../../util/summarizer';

interface BenchmarkGraphEntry extends MergeableRecord {
	name:   string,
	unit:   string,
	value:  number,
	range?: string,
	extra?: string
}

/** ns to ms */
function ms(nanoseconds: number): number {
	return nanoseconds / 1e6;
}

/**
 * The median is a lot less sensitive to the load of the machine that produced the measurement than the mean,
 * hence we plot the median whenever there is one and only report the mean as additional information.
 */
function plotValue(measurement: SummarizedMeasurement): number {
	return Number.isFinite(measurement.median) ? measurement.median : measurement.mean;
}

function timeEntry(name: string, measurement: SummarizedMeasurement | undefined): BenchmarkGraphEntry | undefined {
	if(!measurement?.mean || !measurement?.std) {
		return undefined;
	}
	return {
		name,
		unit:  'ms',
		value: ms(plotValue(measurement)),
		range: String(ms(measurement.std)),
		extra: `mean: ${ms(measurement.mean).toFixed(2)}ms`
	};
}

/**
 * Write the graph output for the ultimate slicer stats to a file
 * @param ultimate - The ultimate slicer stats
 * @param outputGraphPath - The path to write the graph output to
 */
export function writeGraphOutput(ultimate: UltimateSlicerStats, outputGraphPath: string) {
	console.log(`Producing benchmark graph data (${outputGraphPath})...`);

	const data: BenchmarkGraphEntry[] = [];

	for(const { name, measurements } of [
		{ name: 'per-file', measurements: ultimate.commonMeasurements },
		{ name: 'per-slice', measurements: ultimate.perSliceMeasurements },
		{ name: 'additional', measurements: ultimate.additionalMeasurements ?? new Map() }
	]) {
		for(const [point, measurement] of measurements) {
			if(point === 'close R session' || point === 'initialize R session') {
				continue;
			}
			const pointName = point === 'total' ? `total ${name}` : point;
			const entry = timeEntry(pointName[0].toUpperCase() + pointName.slice(1), measurement);
			if(entry) {
				data.push(entry);
			}
		}
	}

	// the per 100 lines of input pendants to the per-token measurements, less sensitive to the file size mix
	for(const { name, measurement } of [
		{ name: 'Retrieve AST per 100 lines', measurement: ultimate.retrieveTimePer100Lines },
		{ name: 'Normalize AST per 100 lines', measurement: ultimate.normalizeTimePer100Lines },
		{ name: 'Dataflow per 100 lines', measurement: ultimate.dataflowTimePer100Lines },
		{ name: 'Control flow per 100 lines', measurement: ultimate.controlFlowTimePer100Lines },
		{ name: 'Static slicing per 100 lines', measurement: ultimate.sliceTimePer100Lines },
		{ name: 'Reconstruct code per 100 lines', measurement: ultimate.reconstructTimePer100Lines },
		{ name: 'Total common per 100 lines', measurement: ultimate.totalCommonTimePer100Lines },
		{ name: 'Total per-slice per 100 lines', measurement: ultimate.totalPerSliceTimePer100Lines }
	]) {
		const entry = timeEntry(name, measurement);
		if(entry) {
			data.push(entry);
		}
	}

	// what the analyzed version of flowR itself carries, so a release also shows how the feature set grew
	for(const [name, value] of [
		['linting rules', ultimate.features?.lintingRules],
		['queries', ultimate.features?.queries],
		['built-in definitions', ultimate.features?.builtinDefinitions],
		['built-in definitions (default handler)', ultimate.features?.builtinDefinitionsDefault],
		['built-in definitions (own handler)', ultimate.features?.builtinDefinitionsCustom],
		['built-in definitions (with eval handler)', ultimate.features?.builtinDefinitionsWithEvalHandler]
	] as const) {
		if(typeof value === 'number') {
			data.push({ name, unit: '#', value });
		}
	}
	for(const [tag, value] of Object.entries(ultimate.features?.lintingRulesByTag ?? {})) {
		if(typeof value === 'number') {
			data.push({ name: `linting rules (${tag})`, unit: '#', value });
		}
	}
	data.push({
		name:  'number of files',
		unit:  '#',
		value: ultimate.totalRequests
	});
	data.push({
		name:  'number of slices',
		unit:  '#',
		value: ultimate.totalSlices
	});

	// what the analysis works on and produces, so a change in runtime can be related to a change in size
	for(const [name, measurement] of [
		['input lines', ultimate.input.numberOfLines],
		['input tokens (normalized)', ultimate.input.numberOfNormalizedTokens],
		['dataflow vertices', ultimate.dataflow.numberOfNodes],
		['dataflow edges', ultimate.dataflow.numberOfEdges],
		['dataflow calls', ultimate.dataflow.numberOfCalls],
		['dataflow function definitions', ultimate.dataflow.numberOfFunctionDefinitions],
		['control flow vertices', ultimate.controlFlow?.numberOfVertices],
		['control flow edges', ultimate.controlFlow?.numberOfEdges]
	] as const) {
		if(measurement) {
			data.push({
				name,
				unit:  '#',
				value: plotValue(measurement),
				range: String(measurement.std),
				extra: `mean: ${measurement.mean.toFixed(2)}`
			});
		}
	}
	data.push({
		name:  'failed to reconstruct/re-parse',
		unit:  '#',
		value: ultimate.failedToRepParse,
		extra: `out of ${ultimate.totalSlices} slices`
	});
	data.push({
		name:  'times hit threshold',
		unit:  '#',
		value: ultimate.timesHitThreshold
	});
	// the reduction without comments and empty lines tells a different story than the raw one
	for(const [name, measurement] of [
		['reduction (lines)', ultimate.reduction.numberOfLines],
		['reduction (dataflow vertices)', ultimate.reduction.numberOfDataflowNodes],
		['reduction no fluff (characters)', ultimate.reductionNoFluff.numberOfCharacters],
		['reduction no fluff (normalized tokens)', ultimate.reductionNoFluff.numberOfNormalizedTokens]
	] as const) {
		if(measurement) {
			data.push({
				name,
				unit:  '#',
				value: plotValue(measurement),
				extra: `mean: ${measurement.mean}, std: ${measurement.std}`
			});
		}
	}
	data.push({
		name:  'reduction (characters)',
		unit:  '#',
		value: plotValue(ultimate.reduction.numberOfCharacters),
		extra: `mean: ${ultimate.reduction.numberOfCharacters.mean}, std: ${ultimate.reduction.numberOfCharacters.std}`
	});
	data.push({
		name:  'reduction (normalized tokens)',
		unit:  '#',
		value: plotValue(ultimate.reduction.numberOfNormalizedTokens),
		extra: `mean: ${ultimate.reduction.numberOfNormalizedTokens.mean}, std: ${ultimate.reduction.numberOfNormalizedTokens.std}`
	});
	if(ultimate.controlFlow) {
		data.push({
			name:  'memory (cfg-graph)',
			unit:  'KiB',
			value: plotValue(ultimate.controlFlow.sizeOfObject) / 1024,
			range: String(ultimate.controlFlow.sizeOfObject.std / 1024),
			extra: `mean: ${(ultimate.controlFlow.sizeOfObject.mean / 1024).toFixed(2)}`
		});
	}
	data.push({
		name:  'memory (df-graph)',
		unit:  'KiB',
		value: plotValue(ultimate.dataflow.sizeOfObject) / 1024,
		range: String(ultimate.dataflow.sizeOfObject.std / 1024),
		extra: `mean: ${(ultimate.dataflow.sizeOfObject.mean / 1024).toFixed(2)}`
	});


	// write the output file
	fs.writeFileSync(outputGraphPath, JSON.stringify(data, jsonReplacer));
}
