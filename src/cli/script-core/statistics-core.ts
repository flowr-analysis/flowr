import path from 'path';
import type { Arguments } from '../../util/parallel';
import { LimitedThreadPool } from '../../util/parallel';
import { allRFilesFrom } from '../../util/files';
import { retrieveArchiveName, validateFeatures } from '../common/features';
import fs from 'fs';
import { initFileProvider } from '../../statistics/output/statistics-file';
import { jsonReplacer } from '../../util/json';
import { log } from '../../util/log';
import type { StatsCliOptions } from '../statistics-app';
import { getStatsForSingleFile } from './statistics-helper-core';
import commandLineArgs from 'command-line-args';
import { scripts } from '../common/scripts-info';
import type { StatsHelperCliOptions } from '../statistics-helper-app';
import { setFormatter, voidFormatter } from '../../util/text/ansi';
import type { FlowrConfigOptions } from '../../config';

const testRegex = /[^/]*\/test/i;
const exampleRegex = /[^/]*\/example/i;

function getPrefixForFile(file: string) {
	if(testRegex.test(file)) {
		return 'test-';
	}	else if(exampleRegex.test(file)) {
		return 'example-';
	} else {
		return '';
	}
}

function getSuffixForFile(base: string, file: string) {
	const subpath = path.relative(base, file);
	return '--' + subpath.replace(/\//g, '／');
}

async function collectFileArguments(options: StatsCliOptions, verboseAdd: readonly string[], dumpJson: readonly string[], features: readonly string[]) {
	const files: Arguments[] = [];
	let counter = 0;
	let presentSteps = 5000;
	let skipped = 0;
	for await (const f of allRFilesFrom(options.input)) {
		const outputDir = path.join(options['output-dir'], `${getPrefixForFile(f.content)}${getSuffixForFile(options.input.length === 1 ? options.input[0] : '', f.content)}`);
		const target = retrieveArchiveName(outputDir);
		if(fs.existsSync(target)) {
			console.log(`Archive ${target} exists. Skip.`);
			skipped++;
			continue;
		}
		files.push(['--input', f.content, '--output-dir', outputDir,'--compress', '--root-dir', options.input.length === 1 ? options.input[0] : '""', ...verboseAdd, ...features, ...dumpJson]);
		if(++counter % presentSteps === 0) {
			console.log(`Collected ${counter} files`);
			if(counter >= 10 * presentSteps) {
				presentSteps *= 5;
			}
		}
	}
	console.log(`Total: ${counter} files (${skipped} skipped with archive existing)`);
	return files;
}

export async function flowrScriptGetStats(config: FlowrConfigOptions, options: StatsCliOptions) {
	if(options.input.length === 0) {
		console.error('No input files given. Nothing to do. See \'--help\' if this is an error.');
		process.exit(0);
	}

	if(options['no-ansi']) {
		log.info('disabling ansi colors');
		setFormatter(voidFormatter);
	}

	const processedFeatures = validateFeatures(options.features);
	initFileProvider(options['output-dir']);
	console.log(`Processing features: ${JSON.stringify(processedFeatures, jsonReplacer)}`);
	console.log(`Using ${options.parallel} parallel executors`);

	const verboseAdd = options.verbose ? ['--verbose'] : [];
	const features = [...processedFeatures].flatMap(s => ['--features', s]);
	const dumpJson = options['dump-json'] ? ['--dump-json'] : [];

	// we do not use the limit argument to be able to pick the limit randomly
	const args = await collectFileArguments(options, verboseAdd, dumpJson, features);

	if(options.limit) {
		console.log('Shuffle...');
		log.info(`limiting to ${options.limit} files`);
		// shuffle and limit
		args.sort(() => Math.random() - 0.5);
	}
	console.log('Prepare Pool...');

	const limit = options.limit ?? args.length;

	if(options.parallel > 0) {
		const pool = new LimitedThreadPool(
			`${__dirname}/statistics-helper-app`,
			args,
			limit,
			options.parallel
		);
		console.log('Run Pool...');
		await pool.run();
		const stats = pool.getStats();
		console.log(`Processed ${stats.counter} files, skipped ${stats.skipped.length} files due to errors`);
	} else {
		console.log('Run Sequentially as parallel <= 0...');
		for(const arg of args) {
			await getStatsForSingleFile(config, commandLineArgs(scripts['stats-helper'].options, { argv: arg }) as StatsHelperCliOptions);
		}
	}
}
