import csvParser from 'csv-parser';
import type { UnresolvedDataType } from '../subtyping/types';
import { UnresolvedRTypeIntersection } from '../subtyping/types';
import type { TraceCsvRow } from './traced-function-types';
import { extractTypesFromTraceData } from './traced-function-types';
import { turcotte2RohdeTypes, type TurcotteCsvRow } from './turcotte-types';
import fs from 'fs';

export async function loadTurcotteTypes(typeMap: Map<string, UnresolvedDataType> = new Map()): Promise<Map<string, UnresolvedDataType>> {
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
		const label = info.name; //`${info.package}::${info.name}`;
		if('type' in info) {
			typeMap.set(label, info.type);
		}
		if('types' in info) {
			const type = info.types.length === 1 ? info.types[0] : new UnresolvedRTypeIntersection(...info.types);
			typeMap.set(label, type);
		}
	}

	return typeMap;
}

export async function loadTracedTypes(typeMap: Map<string, UnresolvedDataType> = new Map()): Promise<Map<string, UnresolvedDataType>> {
	const data: TraceCsvRow[] = [];
	await new Promise(resolve => {
		fs.createReadStream('src/typing/adapter/traced-function-types.csv', { encoding: 'utf-8' })
			.pipe(csvParser({ separator: ',' }))
			.on('data', (row: TraceCsvRow) => {
				data.push(row);
			})
			.on('end', () => resolve(null));
	});
	
	console.log(data.length);
	const [functionTypeInfos, contributions] = extractTypesFromTraceData(data);
	console.log(contributions);
	for(const info of functionTypeInfos) {
		const label = info.name;
		const type = info.types.length === 1 ? info.types[0] : new UnresolvedRTypeIntersection(...info.types);
		typeMap.set(label, type);
	}

	return typeMap;
}