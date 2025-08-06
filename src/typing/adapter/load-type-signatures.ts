import csvParser from 'csv-parser';
import type { UnresolvedDataType } from '../subtyping/types';
import type { TraceCsvRow } from './traced-function-types';
import { extractTypesFromTraceData } from './traced-function-types';
import { turcotte2RohdeTypes, type TurcotteCsvRow } from './turcotte-types';
import fs from 'fs';

export async function loadTurcotteTypes(typeMap: Map<string, Set<UnresolvedDataType>> = new Map()): Promise<Map<string, Set<UnresolvedDataType>>> {
	const data: TurcotteCsvRow[] = [];
	await new Promise(resolve => {
		fs.createReadStream('src/typing/adapter/turcotte-types.csv', { encoding: 'utf-8' })
			.pipe(csvParser({ separator: ',' }))
			.on('data', (row: TurcotteCsvRow) => {
				data.push(row);
			})
			.on('end', () => resolve(null));
	});
	
	const rohdeTypes = turcotte2RohdeTypes(data);
	for(const info of rohdeTypes.info) {
		const label = info.name;

		if(!typeMap.has(label)) {
			typeMap.set(label, new Set());
		}

		if('type' in info) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			typeMap.get(label)!.add(info.type);
		}
		if('types' in info) {
			for(const type of info.types) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				typeMap.get(label)!.add(type);
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

export async function loadTracedTypes(typeMap: Map<string, Set<UnresolvedDataType>> = new Map()): Promise<Map<string, Set<UnresolvedDataType>>> {
	const data: TraceCsvRow[] = [];
	await new Promise(resolve => {
		fs.createReadStream('src/typing/adapter/traced-function-types.csv', { encoding: 'utf-8' })
			.pipe(csvParser({
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
			}))
			.on('data', (row: TraceCsvRow) => {
				data.push(row);
			})
			.on('end', () => resolve(null));
	});
	
	const [functionTypeInfos, _contributions] = extractTypesFromTraceData(data);
	// console.log(contributions);

	for(const info of functionTypeInfos) {
		const label = info.name;
		
		if(!typeMap.has(label)) {
			typeMap.set(label, new Set());
		}
		for(const type of info.types) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			typeMap.get(label)!.add(type);
		}
	}

	return typeMap;
}