import type { ReplCommand } from './repl-main';
import { findSource } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import type {
	RFunctionType } from '../../../typing/types';
import {
	DataTypeTag, RComplexType, RDoubleType, REnvironmentType, RIntegerType, RLanguageType,
	RLogicalType,
	RNullType, RRawType, RStringType
} from '../../../typing/types';
import fs from 'fs';
import csvParser from 'csv-parser';
import { guard } from '../../../util/assert';
import type {
	UnresolvedDataType } from '../../../typing/subtyping/types';
import {
	constrainWithLowerBound, constrainWithUpperBound, getParameterTypeFromFunction, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType,
	UnresolvedRTypeUnion,
	UnresolvedRTypeVariable
} from '../../../typing/subtyping/types';
import { prettyPrint } from '../../../typing/pretty-print';
import { ColorEffect, Colors } from '../../../util/text/ansi';

interface FunctionTypeInformation {
	readonly name:    string;
	readonly package: string;
	readonly type:    readonly RFunctionType[]
}

interface RohdeTypes {
	readonly info: FunctionTypeInformation[];
}

interface TurcotteCsvRow {
	readonly package_name:       string;
	readonly function_name:      string;
	readonly parameter_position: string;
	readonly outer_alternative:  string;
	readonly inner_alternative:  string;
	readonly type:               string;
	readonly count:              string;
}


export const replTurcotteTypeParseCommand: ReplCommand = {
	description:  'Give me a file to read from and I will happily print you the types in the Rohde System!',
	usageExample: ':turcotte-type-parse foo.csv',
	aliases:      [ 'ttp',],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		if(!remainingLine.trim()) {
			output.stderr('Please provide a file to read from. You do not need a prefix, just the file path.');
			return;
		}
		const file = findSource(remainingLine.trim(), { referenceChain: [] });
		if(file?.length !== 1) {
			output.stderr(`Could not find a single file to read from. Got: ${JSON.stringify(file)}`);
			return;
		}

		const data: TurcotteCsvRow[] = [];
		await new Promise(resolve => {
			fs.createReadStream(file[0], { encoding: 'utf-8' })
				.pipe(csvParser({ separator: ',' }))
				.on('data', (row: TurcotteCsvRow) => {
					data.push(row);
				})
				.on('end', () => resolve(null));
		});
		const rohdeTypes: RohdeTypes = turcotte2RohdeTypes(data);
		for(const info of rohdeTypes.info) {
			if(info.type.length <= 1) {
				output.stdout(output.formatter.format(`${info.package}::${info.name} :: `, { color: Colors.White, effect: ColorEffect.Foreground }) + prettyPrint(info.type[0]));
				continue;
			}
			output.stdout(`${info.package}::${info.name} has ${info.type.length} alternatives`);
			for(const type of info.type) {
				output.stdout('  :: ' + prettyPrint(type));
			}
		}
		output.stdout(`Parsed ${rohdeTypes.info.length} functions from ${file[0]}.`);
	}
};

function groupTurcotteData<T>(data: readonly TurcotteCsvRow[], makeKey: (d: TurcotteCsvRow) => T): Map<T, TurcotteCsvRow[]> {
	const grouped: Map<T, TurcotteCsvRow[]> = new Map();
	for(const row of data) {
		const key = makeKey(row);
		if(!grouped.has(key)) {
			grouped.set(key, []);
		}
		grouped.get(key)?.push(row);
	}
	return grouped;
}

function convertTurcotteFunction2RohdeType(fingerprint: string, rows: TurcotteCsvRow[]): FunctionTypeInformation {
	guard(rows.length > 0, `No rows found for fingerprint ${fingerprint}`);

	const anyRow = rows[0];

	// now we group them by their outer_alternative so that we can get the alternatives in order
	const groupedByOuter = groupTurcotteData(rows, row => row.outer_alternative);

	const type = [];
	for(const [, innerRows] of groupedByOuter.entries()) {
		type.push(convertSingleTurcotteFunctionAlternative2RohdeType(fingerprint, innerRows));
	}

	return {
		package: anyRow.package_name,
		name:    anyRow.function_name,
		type
	};
}
const globalCache: Map<UnresolvedDataType, { lowerBounds: Set<UnresolvedDataType>, upperBounds: Set<UnresolvedDataType> }> = new Map();

function constrainLowerAndUpperBound(type: UnresolvedDataType, lowerBound: UnresolvedDataType, upperBound: UnresolvedDataType = lowerBound) {
	constrainWithLowerBound(type, lowerBound, globalCache);
	constrainWithUpperBound(type, upperBound, globalCache);
	return type;
}

function convertSingleTurcotteFunctionAlternative2RohdeType(fingerprint: string, rows: TurcotteCsvRow[]): RFunctionType {
	const groupedByParameterPos = groupTurcotteData(rows, row => row.parameter_position);
	const fn = new UnresolvedRFunctionType();

	for(const [parameterPosition, parameterRows] of groupedByParameterPos.entries()) {
		// convert the rows to a single type
		const type = convertSingleTurcotteParameter2RohdeType(fingerprint, parameterRows);
		if(parameterPosition === '-1') {
			constrainLowerAndUpperBound(fn.returnType, type);
		} else {
			// we get the type to create a new one if not already there
			const parameterType = getParameterTypeFromFunction(fn, Number(parameterPosition));
			// now we can set the type
			constrainLowerAndUpperBound(parameterType, type);
		}
	}

	return fn;
}

function convertSingleTurcotteParameter2RohdeType(fingerprint: string, rows: TurcotteCsvRow[]): UnresolvedDataType {
	// every row here is an alternative for a single parameter position
	guard(rows.length > 0, `No rows found for fingerprint ${fingerprint}`);
	const anyRow = rows[0];
	guard(rows.every(r =>
		r.parameter_position === anyRow.parameter_position &&
		r.package_name === anyRow.package_name &&
		r.outer_alternative === anyRow.outer_alternative &&
		r.function_name === anyRow.function_name), 'Just for my sanity, please!');

	// now we convert all types in the list to the rohde System
	return new UnresolvedRTypeUnion(
		...rows.map(r => turcotteType2RohdeType(r.type))
	);
}


function turcotteType2RohdeType(type: string): UnresolvedDataType {
	const isArray = type.endsWith('[]');
	if(isArray) {
		type = type.slice(0, -2); // remove the []
	}
	// it may contain NAs, currently untracked by the Rohde System
	if(type.startsWith('^')) {
		type = type.slice(1); // remove the ^
	}
	let r: UnresolvedDataType | undefined = undefined;
	switch(type) {
		case 'any':         r = new UnresolvedRTypeVariable(); break;
		case 'null':        r = new RNullType(); break;
		case 'logical':     r = new RLogicalType(); break;
		case 'integer':     r = new RIntegerType(); break;
		case 'double':      r = new RDoubleType(); break;
		case 'character':   r = new RStringType(); break;
		case 'complex':     r = new RComplexType(); break;
		case 'environment': r = new REnvironmentType(); break;
		case 'raw':         r = new RRawType(); break;
		case 'expression':  r = new RLanguageType(); break;
		case 'externalptr': r = new UnresolvedRTypeVariable(); break;
		case 'pairlist':    r = new UnresolvedRTypeVariable(); break;
		default:
			r = parseComplicatedTurcotteType(type);
	}

	guard(r !== undefined, `Unknown type ${JSON.stringify(type)} in Turcotte data!`);

	if(isArray) {
		if(r.tag !== DataTypeTag.Variable) {
			const vectorType = new UnresolvedRAtomicVectorType();
			constrainLowerAndUpperBound(vectorType.elementType, r);
			r = vectorType;
		} else {
			r = new UnresolvedRAtomicVectorType(r);
		}
	}

	return r;
}

function alternativeTurcotteType2RohdeType(type: string[]): UnresolvedDataType {
	if(type.length === 0) {
		return new UnresolvedRTypeVariable();
	}
	if(type.length === 1) {
		return turcotteType2RohdeType(type[0]);
	}
	const types = type.map(t => turcotteType2RohdeType(t));
	return new UnresolvedRTypeUnion(...types);
}


function turcotte2RohdeTypes(data: TurcotteCsvRow[]): RohdeTypes {
	// why even?
	guard(data.every(d => d.count === '1'), 'What the count?');

	// first we group the data by package::function name to get the alternatives in order!
	const groupedData = groupTurcotteData(data, row => `${row.package_name}::${row.function_name}`);

	const info: FunctionTypeInformation[] = [];
	for(const [fingerprint, rows] of groupedData.entries()) {
		info.push(convertTurcotteFunction2RohdeType(fingerprint, rows));
	}

	return { info };
}



function parseComplicatedTurcotteType(type: string): UnresolvedDataType | undefined {
	// everything up until the first parse <1, 2 | 3, 4 & 5> etc. recursively!
	const [prefix, main] = type.split(/<(.*)/, 2);

	// no can do's
	switch(prefix) {
		case 'class':
			// Rohde currently does not support classes, so we just return a variable type
			return new UnresolvedRTypeVariable();
		case '...':
			// there may be arbitrary more parameters - we do not know their type
			return new UnresolvedRTypeVariable();
	}

	guard(main.endsWith('>'), `Invalid Turcotte type ${JSON.stringify(type)}!`);

	const argString = main.slice(0, -1);

	const params = collectParams(argString);

	switch(prefix) {
		case 'list': {
			guard(params.length === 1, `List type ${JSON.stringify(type)} must have exactly one parameter!`);
			const listType = new UnresolvedRListType();
			constrainLowerAndUpperBound(listType.elementType, alternativeTurcotteType2RohdeType(params[0]));
			return listType;
		}

	}

	return undefined;
}

// collect params, splitting on alternatives '|'
function collectParams(argString: string): string[][] {
	// split at comma but respect nestings with <>
	const params: string[][] = [];
	const currentParamAlternatives: string[] = [];
	let current = '';
	let depth = 0;
	let quoted = false;
	for(const char of argString) {
		if(char === '"' || char === "'" || char === '`') {
			quoted = !quoted; // toggle quoted state
			current += char;
			continue;
		}
		if(char === '<' && !quoted) {
			depth++;
		} else if(char === '>' && !quoted) {
			depth--;
		} else if(!quoted && char === ',' && depth === 0) {
			params.push([...currentParamAlternatives, current.trim()]);
			current = '';
			continue;
		} else if(char === '|' && !quoted && depth === 0) {
			// split on alternatives
			if(current.trim().length > 0) {
				currentParamAlternatives.push(current.trim());
			}
			current = '';
			continue;
		}
		current += char;
	}

	if(current.trim().length > 0) {
		currentParamAlternatives.push(current.trim());
	}
	if(currentParamAlternatives.length > 0) {
		params.push(currentParamAlternatives);
	}
	return params;
}