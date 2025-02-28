import fs from 'fs';
import path from 'path';
import { guard } from '../util/assert';
import { allRFiles } from '../util/files';
import { log } from '../util/log';
import { LimitedThreadPool } from '../util/parallel';
import { processCommandLineArgs } from './common/script';
import type { RParseRequestFromFile } from '../r-bridge/retriever';
import type { KnownParserName } from '../r-bridge/parser';

export interface BenchmarkCliOptions {
	verbose:                   boolean
	help:                      boolean
	input:                     string[]
	output:                    string
	slice:                     string
	parallel:                  number
	limit?:                    number
	runs?:                     number
	parser:                    KnownParserName
	'enable-pointer-tracking': boolean
}

const options = processCommandLineArgs<BenchmarkCliOptions>('benchmark', [],{
	subtitle: 'Slice given files with additional benchmark information',
	examples: [
		'{italic example-folder/}',
		'{bold --help}'
	]
});

if(options.input.length === 0) {
	console.error('No input files given. Nothing to do. See \'--help\' if this is an error.');
	process.exit(0);
}

const numberRegex = /^\d+$/;

guard(options.slice === 'all' || options.slice === 'no' || numberRegex.test(options.slice), 'slice must be either all, no, or a number');

guard(options.runs === undefined || options.runs > 0, 'runs must be greater than zero');

function removeIfExists(summarizedRaw: string) {
	if(fs.existsSync(summarizedRaw)) {
		console.log(`Removing existing ${summarizedRaw}`);
		try {
			fs.rmSync(summarizedRaw, { recursive: true });
		} catch{
			log.error('failure in cleanup');
		}
	}
}

interface RequestFile {
	request: RParseRequestFromFile;
	baseDir: string;
}

async function benchmark() {
	removeIfExists(options.output);
	fs.mkdirSync(options.output, { recursive: true });

	console.log(`Storing output in ${options.output}`);
	console.log(`Using ${options.parallel} parallel executors`);
	// we do not use the limit argument to be able to pick the limit randomly
	const files: RequestFile[] = [];

	const firstFile = options.input[0];
	// Check whether input is single JSON file containing a list of paths
	if(options.input.length === 1 && fs.statSync(firstFile).isFile() && firstFile.endsWith('.json')) {
		console.log('Input is a single JSON file. Assuming it contains a list of files to process');
		const content = fs.readFileSync(firstFile, 'utf8');
		const paths = JSON.parse(content) as string[];
		const baseDir = findCommonBaseDir(paths);

		await collectFiles(files, paths, () => baseDir);
	} else {
		await collectFiles(files, options.input, (path) => path);
	}

	if(options.limit) {
		log.info(`limiting to ${options.limit} files`);
		// shuffle and limit
		files.sort(() => Math.random() - 0.5);
	}
	const limit = options.limit ?? files.length;

	const verboseAdd = options.verbose ? ['--verbose'] : [];
	const args = files.map((f,i) => [
		'--input', f.request.content,
		'--file-id', `${i}`,
		'--output', path.join(options.output, path.relative(f.baseDir, `${f.request.content}.json`)),
		'--slice', options.slice, ...verboseAdd,
		'--parser', options.parser,
		...(options['enable-pointer-tracking'] ? ['--enable-pointer-tracking'] : []),
	]);

	const runs = options.runs ?? 1;
	for(let i = 1; i <= runs; i++) {
		console.log(`Run ${i} of ${runs}`);
		const pool = new LimitedThreadPool(
			`${__dirname}/benchmark-helper-app`,
			// we reverse here "for looks", since the helper pops from the end, and we want file ids to be ascending :D
			args.map(a => [...a, '--run-num', `${i}`]).reverse(),
			limit,
			options.parallel
		);
		await pool.run();
		const stats = pool.getStats();
		console.log(`Run ${i} of ${runs}: Benchmarked ${stats.counter} files, skipped ${stats.skipped.length} files due to errors`);
	}
}

/**
 * Collect all R files from the given paths.
 * 
 * @param files - list of files to append to
 * @param paths - list of paths to search for R files
 * @param getBaseDir - function to get the base directory of a path
 */
async function collectFiles(files: RequestFile[], paths: string[], getBaseDir: (path: string) => string) {
	for(const input of paths) {
		for await (const file of allRFiles(input)) {
			files.push({ request: file, baseDir: getBaseDir(input) });
		}
	}
}

/**
 * Find the common base directory of a list of paths.
 * 
 * @param paths - list of paths
 * @returns the common base directory
 */
function findCommonBaseDir(paths: string[]): string {
	const baseDirs = paths.map(f => path.dirname(f));
	const baseDir = baseDirs.reduce((acc, dir) => {
		const split = dir.split('/');
		const accSplit = acc.split('/');
		let i = 0;
		while(i < split.length && i < accSplit.length && split[i] === accSplit[i]) {
			i++;
		}
		return split.slice(0, i).join('/');
	}, baseDirs[0]);
	return baseDir;
}

void benchmark();
