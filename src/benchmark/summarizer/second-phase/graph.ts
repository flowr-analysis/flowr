import type { UltimateSlicerStats } from '../data';
import fs from 'fs';
import type { MergeableRecord } from '../../../util/objects';
import { jsonReplacer } from '../../../util/json';
import type { SummarizedMeasurement } from '../../../util/summarizer';
import { countFeatures } from '../../stats/feature-counts';
import { countSignatureDatabase } from '../../stats/sigdb-counts';
import type { SigDbCounts } from '../../stats/stats';

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
 * Every plotted number is the mean, so that one series never mixes two statistics: a run that switches
 * to the median steps up or down by the skew of the corpus, which reads as a change that never happened.
 * The median travels along as additional information, see {@link plotExtra}.
 */
function plotValue(measurement: SummarizedMeasurement): number {
	return Number.isFinite(measurement.mean) ? measurement.mean : measurement.median;
}

/** the statistics a plotted mean is worth nothing without, stated on hover */
function plotExtra(measurement: SummarizedMeasurement, digits = 2, scale = 1, unit = ''): string {
	const say = (v: number) => (v * scale).toFixed(digits) + unit;
	return `median: ${say(measurement.median)}, std: ${say(measurement.std)}`;
}

/**
 * Whether an entry describes what the release *is* rather than how fast it *was*.
 *
 * The benchmark action compares every entry it uploads against the release before and calls a value that grew
 * a regression. That is right for a runtime and wrong for a counter: a release with ten more linting rules or a
 * larger signature database is not slower. Those entries are written to {@link infoGraphPath} instead and are
 * uploaded under a suite of their own, where nothing alerts on them. The page merges the two back together.
 *
 * The failures are counters too, but a run that fails to re-parse more slices than the one before is exactly
 * what an alert is for, so they stay with the measurements.
 */
export function isInfoEntry({ name, unit }: Pick<BenchmarkGraphEntry, 'name' | 'unit'>): boolean {
	if(name.startsWith(SigDbPrefix)) {
		return true; // the database ships with the release, its size is not this run being slow
	}
	if(unit === 'ms' || name.startsWith('memory')) {
		return false; // a runtime or a size the analysis has to hold, both worth an alert
	}
	return unit === '#' && !/^(reduction|failed|times hit)/.test(name);
}

/** where the counters of `path` go, next to it, so that one upload can alert and the other cannot */
export function infoGraphPath(path: string): string {
	return path.replace(/(\.json)?$/, m => '-info' + (m || '.json'));
}

function timeEntry(name: string, measurement: SummarizedMeasurement | undefined, pick = plotValue): BenchmarkGraphEntry | undefined {
	if(!measurement?.mean || !measurement?.std) {
		return undefined;
	}
	return {
		name,
		unit:  'ms',
		value: ms(pick(measurement)),
		range: String(ms(measurement.std)),
		extra: plotExtra(measurement, 2, 1 / 1e6, 'ms')
	};
}

/**
 * How fast the machine was, from the samples of the fixed synthetic workload. Interference on a shared
 * runner only ever *adds* time, so the samples are skewed to the right and their mean is the machine plus
 * whatever else ran beside it. The median holds that off; taking the mean lets a busy runner pass as a
 * slow machine, and every measurement normalized by it is scaled by that noise instead of freed from it.
 */
function calibrationValue(measurement: SummarizedMeasurement): number {
	return Number.isFinite(measurement.median) && measurement.median > 0 ? measurement.median : plotValue(measurement);
}

const SigDbPrefix = 'signature database';

/** bytes to KiB */
function kib(bytes: number): number {
	return bytes / 1024;
}

/**
 * What the signature database of the benchmarked release carries. It describes the machine, not a single
 * measurement, so it is counted here, once, after every measured phase, and a machine without a mounted
 * database simply contributes nothing.
 */
function signatureDatabaseEntries(counts: SigDbCounts | undefined): BenchmarkGraphEntry[] {
	if(counts === undefined) {
		return [];
	}
	const data: BenchmarkGraphEntry[] = [];
	const count = (name: string, value: number | undefined) => {
		if(typeof value === 'number') {
			data.push({ name: `${SigDbPrefix} ${name}`, unit: '#', value });
		}
	};
	const bytes = (name: string, value: number | undefined) => {
		if(typeof value === 'number') {
			data.push({ name: `${SigDbPrefix} ${name}`, unit: 'KiB', value: kib(value) });
		}
	};
	count('bundles', counts.bundles);
	for(const [kind, value] of Object.entries(counts.bundlesByKind ?? {})) {
		count(`bundles (${kind})`, value);
	}
	count('packages', counts.packages);
	count('package versions', counts.packageVersions);
	count('functions', counts.functions);
	for(const [kind, value] of Object.entries(counts.functionsByKind ?? {})) {
		count(`functions (${kind})`, value);
	}
	count('base functions', counts.base?.functions);
	count('base parameters', counts.base?.parameters);
	for(const [carries, value] of Object.entries(counts.base?.functionsCarrying ?? {})) {
		count(`base functions (${carries})`, value);
	}
	bytes('size', counts.size);
	for(const [kind, value] of Object.entries(counts.sizeByKind ?? {})) {
		bytes(`size (${kind})`, value);
	}
	bytes('size (dictionaries)', counts.sizeOfDictionaries);
	bytes('size (manifests)', counts.sizeOfManifests);
	return data;
}

/**
 * Write the graph output for the ultimate slicer stats to a file
 * @param ultimate        - The ultimate slicer stats
 * @param outputGraphPath - The path to write the graph output to
 */
export async function writeGraphOutput(ultimate: UltimateSlicerStats, outputGraphPath: string) {
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
			const entry = timeEntry(pointName[0].toUpperCase() + pointName.slice(1), measurement,
				point === 'calibration' ? calibrationValue : plotValue);
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

	// what the analyzed version of flowR itself carries, so a release also shows how the feature set grew.
	// It describes the version, not the suite, so it is counted here, once, instead of in every benchmarked file.
	const features = countFeatures();
	for(const [name, value] of [
		['linting rules', features.lintingRules],
		['queries', features.queries],
		['plugins', features.plugins],
		['built-in definitions', features.builtinDefinitions],
		['built-in definitions (default handler)', features.builtinDefinitionsDefault],
		['built-in definitions (own handler)', features.builtinDefinitionsCustom],
		['built-in definitions (with eval handler)', features.builtinDefinitionsWithEvalHandler]
	] as const) {
		if(typeof value === 'number') {
			data.push({ name, unit: '#', value });
		}
	}
	for(const [tag, value] of Object.entries(features.lintingRulesByTag)) {
		if(typeof value === 'number') {
			data.push({ name: `linting rules (${tag})`, unit: '#', value });
		}
	}
	/* the names ride along in `extra`, so the page can say which plugins a type stands for */
	for(const [type, names] of Object.entries<readonly string[]>(features.pluginsByType ?? {})) {
		if(Array.isArray(names)) {
			data.push({ name: `plugins (${type})`, unit: '#', value: names.length, extra: names.slice().sort().join(', ') });
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
		['dataflow control flow edges', ultimate.dataflow.numberOfControlFlowEdges],
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
				extra: plotExtra(measurement)
			});
		}
	}
	// what the data frame shape inference sees and how precise it is, so a change in its precision becomes visible
	const shapes = ultimate.dataFrameShape;
	if(shapes) {
		const files = shapes.numberOfDataFrameFiles + shapes.numberOfNonDataFrameFiles;
		data.push({
			name:  'files with data frames',
			unit:  '#',
			value: shapes.numberOfDataFrameFiles,
			extra: `out of ${files} files`
		});
		// only a few files of a suite use data frames at all, so the median over all files would be zero
		for(const [name, measurement] of [
			['data frame operations', shapes.numberOfOperations],
			['data frame operation nodes', shapes.numberOfOperationNodes],
			['data frame value nodes', shapes.numberOfValueNodes],
			['data frame constraints', shapes.numberOfTotalConstraints],
			['data frame shapes (exact)', shapes.numberOfTotalExact],
			['data frame shapes (bottom)', shapes.numberOfTotalBottom],
			['data frame shapes (top)', shapes.numberOfTotalTop]
		] as const) {
			data.push({
				name,
				unit:  '#',
				value: measurement.total,
				extra: `mean: ${measurement.mean.toFixed(2)} per file, median: ${measurement.median.toFixed(2)}`
			});
		}
		data.push({
			name:  'memory (df-shapes)',
			unit:  'KiB',
			value: plotValue(shapes.sizeOfInfo) / 1024,
			range: String(shapes.sizeOfInfo.std / 1024),
			extra: plotExtra(shapes.sizeOfInfo, 2, 1 / 1024, ' KiB')
		});
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
				extra: plotExtra(measurement, 4)
			});
		}
	}
	data.push({
		name:  'reduction (characters)',
		unit:  '#',
		value: plotValue(ultimate.reduction.numberOfCharacters),
		extra: plotExtra(ultimate.reduction.numberOfCharacters, 4)
	});
	data.push({
		name:  'reduction (normalized tokens)',
		unit:  '#',
		value: plotValue(ultimate.reduction.numberOfNormalizedTokens),
		extra: plotExtra(ultimate.reduction.numberOfNormalizedTokens, 4)
	});
	if(ultimate.controlFlow) {
		data.push({
			name:  'memory (cfg-graph)',
			unit:  'KiB',
			value: plotValue(ultimate.controlFlow.sizeOfObject) / 1024,
			range: String(ultimate.controlFlow.sizeOfObject.std / 1024),
			extra: plotExtra(ultimate.controlFlow.sizeOfObject, 2, 1 / 1024, ' KiB')
		});
	}
	data.push({
		name:  'memory (df-graph)',
		unit:  'KiB',
		value: plotValue(ultimate.dataflow.sizeOfObject) / 1024,
		range: String(ultimate.dataflow.sizeOfObject.std / 1024),
		extra: plotExtra(ultimate.dataflow.sizeOfObject, 2, 1 / 1024, ' KiB')
	});

	// the database is a property of the release, not of a file, so it is counted once and comes last
	data.push(...signatureDatabaseEntries(await countSignatureDatabase()));

	/* the counters go into a file of their own, see infoGraphPath */
	fs.writeFileSync(outputGraphPath, JSON.stringify(data.filter(e => !isInfoEntry(e)), jsonReplacer));
	fs.writeFileSync(infoGraphPath(outputGraphPath), JSON.stringify(data.filter(isInfoEntry), jsonReplacer));
}
