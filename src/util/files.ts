import fs, { type PathLike , promises as fsPromise } from 'fs';
import path from 'path';
import { log } from './log';
import LineByLine from 'n-readlines';
import type { RParseRequestFromFile } from '../r-bridge/retriever';
import type { FlowrFileProvider } from '../project/context/flowr-file';

/**
 * Represents a table, identified by a header and a list of rows.
 */
export interface Table {
	header: string[]
	rows:   string[][]
}

/**
 * Retrieves all files in the given directory recursively
 * @param dir    - Directory path to start the search from
 * @param suffix - Suffix of the files to be retrieved
 * Based on {@link https://stackoverflow.com/a/45130990}
 * @see {@link getAllFilesSync} for a synchronous version.
 */
export async function* getAllFiles(dir: string, suffix = /.*/): AsyncGenerator<string> {
	const entries = await fsPromise.readdir(dir, { withFileTypes: true, recursive: false });
	for(const subEntries of entries) {
		const res = path.resolve(dir, subEntries.name);
		if(subEntries.isDirectory()) {
			yield* getAllFiles(res, suffix);
		} else if(suffix.test(subEntries.name)) {
			yield res;
		}
	}
}

/**
 * Retrieves all files in the given directory recursively (synchronously)
 * @see {@link getAllFiles} - for an asynchronous version.
 */
export function* getAllFilesSync(dir: string, suffix = /.*/): Generator<string> {
	const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: false });
	for(const subEntries of entries) {
		const res = path.resolve(dir, subEntries.name);
		if(subEntries.isDirectory()) {
			yield* getAllFilesSync(res, suffix);
		} else if(suffix.test(subEntries.name)) {
			yield res;
		}
	}
}

const rFileRegex = /\.[rR]$/;

/**
 * Retrieves all R files in a given directory (asynchronously)
 * @param input - directory-path to start the search from, can be a file as well. Will just return the file then.
 * @param limit - limit the number of files to be retrieved
 * @returns Number of files processed (normally &le; `limit`, is &ge; `limit` if limit was reached).
 *          Will be `1`, if `input` is an R file (and `0` if it isn't).
 * @see getAllFiles
 */
export async function* allRFiles(input: string, limit: number = Number.MAX_VALUE): AsyncGenerator<RParseRequestFromFile, number> {
	let count = 0;
	if(fs.statSync(input).isFile()) {
		if(rFileRegex.test(input)) {
			yield { request: 'file', content: input };
			return 1;
		}
		log.warn(`Input ${input} is not an R file`);
		return 0;
	}

	for await (const f of getAllFiles(input, rFileRegex)) {
		if(++count > limit) {
			return count;
		}
		yield { request: 'file', content: f };
	}
	return count;
}

/**
 * Retrieves all R files in a given set of directories and files (asynchronously)
 * @param inputs - Files or directories to validate for R-files
 * @param limit  - Limit the number of files to be retrieved
 * @returns Number of files processed (&le; limit)
 * @see allRFiles
 */
export async function* allRFilesFrom(inputs: string[], limit?: number): AsyncGenerator<RParseRequestFromFile, number> {
	limit ??= Number.MAX_VALUE;
	if(inputs.length === 0) {
		log.info('No inputs given, nothing to do');
		return 0;
	}
	let count = 0;
	for(const input of inputs) {
		count += yield* allRFiles(input, limit - count);
	}
	return count;
}

/**
 *
 */
export function writeTableAsCsv(table: Table, file: string, sep = ',', newline = '\n') {
	const csv = [table.header.join(sep), ...table.rows.map(row => row.join(sep))].join(newline);
	fs.writeFileSync(file, csv);
}

/**
 * Reads a file line by line and calls the given function for each line.
 * The `lineNumber` starts at `0`.
 * The `maxLines` option limits the maximum number of read lines and is `Infinity` by default.
 * @returns Whether all lines have been successfully read (`false` if `maxLines` was reached)
 *
 * See {@link readLineByLineSync} for a synchronous version.
 */
export async function readLineByLine(filePath: string, onLine: (line: Buffer, lineNumber: number) => Promise<void>, maxLines: number = Infinity): Promise<boolean> {
	if(!(await fs.promises.stat(filePath).catch(() => {}))?.isFile()) {
		log.warn(`File ${filePath} does not exist`);
		return false;
	}
	const reader = new LineByLine(filePath);

	let line: false | Buffer;

	let counter = 0;
	// eslint-disable-next-line no-cond-assign
	while(line = reader.next()) {
		if(counter >= maxLines) {
			return false;
		}
		await onLine(line, counter++);
	}
	return true;
}

/**
 * Reads a file line by line and calls the given function for each line.
 * The `lineNumber` starts at `0`.
 * The `maxLines` option limits the maximum number of read lines and is `Infinity` by default.
 * @returns Whether the file exists and all lines have been successfully read (`false` if `maxLines` was reached)
 *
 * See {@link readLineByLine} for an asynchronous version.
 */
export function readLineByLineSync(filePath: string, onLine: (line: Buffer, lineNumber: number) => void, maxLines: number = Infinity): boolean {
	if(!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
		log.warn(`File ${filePath} does not exist`);
		return false;
	}
	const reader = new LineByLine(filePath);

	let line: false | Buffer;

	let counter = 0;
	// eslint-disable-next-line no-cond-assign
	while(line = reader.next()) {
		if(counter >= maxLines) {
			return false;
		}
		onLine(line, counter++);
	}
	return true;
}

/**
 * Chops off the last part of the given directory path after a path separator, essentially returning the path's parent directory.
 * If an absolute path is passed, the returned path is also absolute.
 * @param directory - The directory whose parent to return
 */
export function getParentDirectory(directory: string): string{
	// apparently this is somehow the best way to do it in node, what
	return directory.split(path.sep).slice(0, -1).join(path.sep);
}

/**
 * Parses the given file in the 'Debian Control Format'.
 * @param file - The file to parse
 * @returns Map containing the keys and values of the provided file.
 */
export function parseDCF(file: FlowrFileProvider<string>): Map<string, string[]> {
	const result = new Map<string, string[]>();
	let currentKey = '';
	let currentValue = '';
	const indentRegex = new RegExp(/^\s/);
	const firstColonRegex = new RegExp(/:(.*)/s);

	const fileContent = file.content().split(/\r?\n/);

	for(const line of fileContent) {
		if(indentRegex.test(line)) {
			currentValue += '\n' + line.trim();
		} else {
			if(currentKey) {
				const values = currentValue ? cleanValues(currentValue) : [];
				result.set(currentKey, values);
			}

			const [key, rest] = line.split(firstColonRegex).map(s => s.trim());
			currentKey = key.trim();
			currentValue = rest.trim();
		}
	}

	if(currentKey) {
		const values = currentValue ? cleanValues(currentValue) : [];
		result.set(currentKey, values);
	}

	return result;
}


const cleanSplitRegex = /[\n,]+/;
const cleanQuotesRegex = /'/g;

function cleanValues(values: string): string[] {
	return values
		.split(cleanSplitRegex)
		.map(s => s.trim().replace(cleanQuotesRegex, ''))
		.filter(s => s.length > 0);
}


/**
 *
 */
export function isFilePath(p: PathLike) {
	return fs.existsSync(p) && fs.statSync(p).isFile();
}