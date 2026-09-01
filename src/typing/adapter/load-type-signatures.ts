import csvParser from 'csv-parser';
import type { TraceCsvRow } from './traced-function-types';
import { extractTypesFromTraceData } from './traced-function-types';
import { turcotte2RohdeTypes, type TurcotteCsvRow } from './turcotte-types';
import type { UnresolvedDataType } from '../subtyping/types';
import type { KnownTypes } from './known-types';
import { qualifiedTypeKey } from './known-types';
import fs from 'fs';
import path from 'path';

/**
 * The corpus CSV `name` as it is reachable from this module, in the build (`dist`) as well as in the dev (`src`)
 * layout, so a run does not depend on the working directory it was started from.
 */
function corpusFile(name: string): string {
	const candidates = [
		path.resolve(__dirname, name),
		path.resolve(__dirname, '../../../../src/typing/adapter', name),
		path.resolve('dist/src/typing/adapter', name),
		path.resolve('src/typing/adapter', name)
	];
	return candidates.find(c => fs.existsSync(c)) ?? candidates[0];
}

function readCsv<Row>(file: string, options?: csvParser.Options): Promise<Row[]> {
	const data: Row[] = [];
	return new Promise((resolve, reject) => {
		fs.createReadStream(file, { encoding: 'utf-8' })
			.on('error', reject)
			.pipe(csvParser(options))
			.on('data', (row: Row) => {
				data.push(row);
			})
			.on('error', reject)
			.on('end', () => resolve(data));
	});
}

function addType(typeMap: KnownTypes, key: string, type: UnresolvedDataType): void {
	let types = typeMap.get(key);
	if(types === undefined) {
		types = new Set();
		typeMap.set(key, types);
	}
	types.add(type);
}

/**
 * Loads the Turcotte corpus into `typeMap`, keyed by the bare function name and by `pkg::name` for the
 * package the corpus states, see {@link KnownTypes}.
 * @param typeMap - The map to add to, a fresh one by default.
 */
export async function loadTurcotteTypes(typeMap: KnownTypes = new Map()): Promise<KnownTypes> {
	const data = await readCsv<TurcotteCsvRow>(corpusFile('turcotte-types.csv'), { separator: ',' });

	const rohdeTypes = turcotte2RohdeTypes(data);
	for(const info of rohdeTypes.info) {
		/* the bare name holds what every package contributes, the qualified one only what its package does */
		const keys = [info.name, qualifiedTypeKey(info.package, info.name)];
		for(const key of keys) {
			if('type' in info) {
				addType(typeMap, key, info.type);
			}
			if('types' in info) {
				for(const type of info.types) {
					addType(typeMap, key, type);
				}
			}
		}
	}

	return typeMap;
}

function trimQuotes(str: string): string {
	if(str.startsWith("'") && str.endsWith("'") || str.startsWith('"') && str.endsWith('"')) {
		return str.slice(1, -1);
	}
	return str;
}

/**
 * Loads our own traced signatures into `typeMap`, keyed by the bare function name.
 * @param typeMap - The map to add to, a fresh one by default.
 */
export async function loadTracedTypes(typeMap: KnownTypes = new Map()): Promise<KnownTypes> {
	const data = await readCsv<TraceCsvRow>(corpusFile('traced-function-types.csv'), {
		separator:  ',',
		mapHeaders: ({ header }) => {
			switch(header.trim()) {
				case 'file':
					return 'package_name';
				case 'fname':
					return 'function_name';
				case 'arg_types':
					return 'parameter_types';
				case 'ret_type':
					return 'return_type';
				default:
					throw new Error(`Unknown header in CSV: ${header}`);
			}
		},
		mapValues: ({ header, value }) => {
			if(header === 'parameter_types') {
				return (value as string).split(',').map(str => trimQuotes(str)).filter(str => str !== '');
			}
			return trimQuotes(value as string);
		}
	});

	const [functionTypeInfos, _contributions] = extractTypesFromTraceData(data);

	/* the trace names the calling function's package, not the callee's, so no qualified key here */
	for(const info of functionTypeInfos) {
		for(const type of info.types) {
			addType(typeMap, info.name, type);
		}
	}

	return typeMap;
}
