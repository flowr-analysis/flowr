import { retrieveArchiveName } from '../common/features';
import fs from 'fs';
import type { FeatureKey } from '../../statistics/features/feature';
import { RShell } from '../../r-bridge/shell';
import { initFileProvider, statisticsFileProvider } from '../../statistics/output/statistics-file';
import { extractUsageStatistics, staticRequests } from '../../statistics/statistics';
import { extractCFG } from '../../util/cfg/cfg';
import { printStepResult, StepOutputFormat } from '../../core/print/print';
import { PARSE_WITH_R_SHELL_STEP } from '../../core/steps/all/core/00-parse';
import { NORMALIZE } from '../../core/steps/all/core/10-normalize';
import { STATIC_DATAFLOW } from '../../core/steps/all/core/20-dataflow';
import { jsonReplacer } from '../../util/json';
import { log } from '../../util/log';
import { guard } from '../../util/assert';
import { date2string } from '../../util/time';
import type { StatsHelperCliOptions } from '../statistics-helper-app';
import { create } from 'tar';
import { setFormatter, voidFormatter } from '../../util/ansi';

function compressFolder(folder: string, target: string) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
	return create({
		gzip:          true,
		file:          target,
		portable:      true,
		preservePaths: false
	}, [folder]).then(() => {
		// now, remove the folder
		fs.rmSync(folder, { recursive: true, force: true });
	}, () => {
		console.log(`failed to compress ${folder}`);
	}).catch((e) => {
		console.error('Error during compression:', e);
	});
}


export async function getStatsForSingleFile(options: StatsHelperCliOptions) {
	if(options['no-ansi']) {
		log.info('disabling ansi colors');
		setFormatter(voidFormatter);
	}

	let target: string | undefined = undefined;
	if(options.compress) {
		target = retrieveArchiveName(options['output-dir']);
		if(fs.existsSync(target)) {
			console.log(`Archive ${target} exists. Skip.`);
			process.exit(0);
		}
	}

	// assume correct
	const processedFeatures = new Set<FeatureKey>(options.features as FeatureKey[]);

	const shell = new RShell();

	initFileProvider(options['output-dir']);

	await shell.obtainTmpDir();
	const stats = await extractUsageStatistics(shell,
		() => { /* do nothing */ },
		processedFeatures,
		staticRequests({ request: 'file', content: options.input }),
		options['root-dir']
	);
	// console.warn(`skipped ${stats.meta.failedRequests.length} requests due to errors (run with logs to get more info)`)

	if(stats.outputs.size === 1) {
		if(options['dump-json']) {
			const [, output] = [...stats.outputs.entries()][0];
			const cfg = extractCFG(output.normalize, output.dataflow.graph);
			statisticsFileProvider.append('output-json', 'parse', await printStepResult(PARSE_WITH_R_SHELL_STEP, output.parse, StepOutputFormat.Json));
			statisticsFileProvider.append('output-json', 'normalize', await printStepResult(NORMALIZE, output.normalize, StepOutputFormat.Json));
			statisticsFileProvider.append('output-json', 'dataflow', await printStepResult(STATIC_DATAFLOW, output.dataflow, StepOutputFormat.Json));
			statisticsFileProvider.append('output-json', 'cfg', JSON.stringify(cfg, jsonReplacer));
		}

		statisticsFileProvider.append('meta', 'stats', JSON.stringify({ ...stats.meta, file: options.input }, jsonReplacer));
		statisticsFileProvider.append('meta', 'features', JSON.stringify(stats.features, jsonReplacer));
	} else {
		log.error(`expected exactly one output vs. ${stats.outputs.size}, got: ${JSON.stringify([...stats.outputs.keys()], jsonReplacer, 2)}`);
	}
	if(options.compress) {
		guard(target !== undefined, 'target must be defined given the compress option');
		console.log(`[${date2string(new Date())}] Compressing ${options['output-dir']} to ${target}`);
		await compressFolder(options['output-dir'], target);
	}

	shell.close();
}
