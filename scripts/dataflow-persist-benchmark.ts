// Run with: npm run bench:dataflow-persist

import fs from 'node:fs';
import path from 'node:path';
import { TreeSitterExecutor } from '../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../src/project/context/flowr-analyzer-context';
import { FlowrFile } from '../src/project/context/flowr-file';
import { persistDataflowGraph, reconstructPersistedDataflowGraph } from '../src/project/incremental/incremental-dataflow-graph/dataflow-persist';
import { Measurements } from '../src/benchmark/stopwatch';
import { printAsMs } from '../src/util/text/time';

const testFileList = [
	'test/performance/suite-artificial/files/long-pipe.r',
	'test/performance/suite-artificial/files/long-pipe-large.r',
	'test/performance/suite-artificial/files/a-lot-of-functions.r',
	'test/performance/suite-artificial/files/a-lot-of-functions-large.r',
	'test/performance/suite-social-science/files/SocialScience/2-Figshare_Output.csv-output/45/R analysis.R'
];

type Phase = 'persist' | 'parse + revive';

async function benchmarkFile(parser: TreeSitterExecutor, filePath: string): Promise<void> {
	const absolutePath = path.resolve(filePath);
	const sourceBytes = fs.statSync(absolutePath).size;

	const context = contextFromInput(`file://${absolutePath}`);
	const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
	const df = result.dataflow;
	const dfFilePath = result.normalize.ast.files[0]?.filePath ?? FlowrFile.INLINE_PATH;

	const measurements = new Measurements<Phase>();

	measurements.measure('persist', () => persistDataflowGraph(df, context, dfFilePath));
	const persisted = context.inc.getPersistedDataflowGraphOf(dfFilePath) ?? '';

	measurements.measure('parse + revive', () => reconstructPersistedDataflowGraph(context, dfFilePath));

	const times = measurements.get();
	const persistNs = times.get('persist') ?? 0n;
	const reconstructNs = times.get('parse + revive') ?? 0n;

	console.log(
		`${filePath}\n` +
		`  source:      ${sourceBytes.toLocaleString()} bytes, ${[...df.graph.vertices(true)].length} dataflow nodes\n` +
		`  persisted:   ${persisted.length.toLocaleString()} bytes (${(persisted.length / Math.max(sourceBytes, 1)).toFixed(1)}x source)\n` +
		`  persist:     ${printAsMs(Number(persistNs) / 1e6)}\n` +
		`  reconstruct: ${printAsMs(Number(reconstructNs) / 1e6)}`
	);
}

void (async() => {
	const targets = testFileList;

	await TreeSitterExecutor.initTreeSitter();
	const parser = new TreeSitterExecutor();

	for(const file of targets) {
		if(!fs.existsSync(file)) {
			console.log(`dataflow-persist-benchmark: skipping missing file ${file}`);
			continue;
		}
		await benchmarkFile(parser, file);
	}
})();