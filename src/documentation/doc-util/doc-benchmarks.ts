import path from 'path';
import { guard } from '../../util/assert';

const BenchmarkDataPath = path.resolve(__dirname, '..', '..', '..', 'wiki', 'stats', 'benchmark', 'data.js');

interface BenchmarkData {
    readonly lastUpdate: number
    readonly repoUrl:    string
    readonly entries:    Record<string, [BenchmarkElement]>
}

interface BenchmarkElement {
    readonly commit:  Record<string, unknown>
    readonly date:    number
    readonly tool:    string
    readonly benches: BenchmarkElementBench[]
}

interface BenchmarkElementBench {
    readonly name:  string
    readonly value: number
    readonly unit:  string
    readonly range: number
    readonly extra: string
}

let benchmarkData = null as BenchmarkData | null;
/**
 *
 */
export async function loadBenchmarkData(): Promise<BenchmarkData> {
	if(benchmarkData === null) {
		// provide a window object to attach to in the import
		(globalThis as Record<string, unknown>)['window'] = {};
		await import(BenchmarkDataPath);
		// @ts-expect-error -- we know that the data is there
		benchmarkData = window['BENCHMARK_DATA'] as BenchmarkData;
	}
	return benchmarkData;
}

/**
 *
 */
export async function getLatestBenchmark(suite: string): Promise<BenchmarkElement> {
	// provide a window object to attach to in the import
	const suiteData = (await loadBenchmarkData()).entries[suite];
	guard(suiteData, `No benchmark data for suite '${suite}' found!`);
	return suiteData.sort((a, b) => b.date - a.date)[0];
}

/**
 *
 */
export async function getLastBenchmarkUpdate(): Promise<number> {
	return (await loadBenchmarkData()).lastUpdate;
}

function getBenchmarkElement(bench: BenchmarkElement, name: string): BenchmarkElementBench {
	const element = bench.benches.find(b => b.name === name);
	guard(element, `No benchmark data for '${name}' found!`);
	return element;
}

/**
 *
 */
export async function getLatestDfAnalysisTime(suite: string): Promise<number> {
	const elem = await getLatestBenchmark(suite);
	const [parse, normalize, analyze] = ['Retrieve AST from R code', 'Normalize R AST', 'Produce dataflow information'].map(name => getBenchmarkElement(elem, name));
	return parse.value + normalize.value + analyze.value;
}