import type { UnresolvedDataType } from '../subtyping/types';
import { UnresolvedRTypeVariable , constrain, getParameterTypeFromFunction, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType } from '../subtyping/types';
import { RComplexType, RDoubleType, REnvironmentType, RIntegerType, RLanguageType, RLogicalType, RNullType, RRawType, RStringType } from '../types';
import type { RohdeFunctionTypeInformation } from './interface';

export interface TraceCsvRow {
	readonly package_name:    string;
	readonly function_name:   string;
	readonly parameter_types: string[];
	readonly return_type:     string;
}

export function extractTypesFromTraceData(data: readonly TraceCsvRow[]): [RohdeFunctionTypeInformation[], Map<string, number>] {
	const extractedTypes: Map<string, Map<string, UnresolvedRFunctionType[]>> = new Map();
	const unseenSignaturePackageContributions: Map<string, Set<string>> = new Map();

	for(const row of data) {
		const argumentTypes = row.parameter_types.map(typeFromStr);
		const returnType = typeFromStr(row.return_type);

		const signature = `${row.function_name} : (${row.parameter_types.join(', ')}) -> ${row.return_type}`;
		if(!unseenSignaturePackageContributions.values().some(set => set.has(signature))) {
			if(!unseenSignaturePackageContributions.has(row.package_name)) {
				unseenSignaturePackageContributions.set(row.package_name, new Set([signature]));
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				unseenSignaturePackageContributions.get(row.package_name)!.add(signature);
			}
			// if(row.function_name === 'print') {
			// 	console.log('Found print signature:', signature);
			// }
		} else {
			continue; // Skip if we have already seen this signature for this package
		}

		const functionType = new UnresolvedRFunctionType();
		for(const [index, type] of argumentTypes.entries()) {
			constrain(getParameterTypeFromFunction(functionType, index), type);
			constrain(type, getParameterTypeFromFunction(functionType, index));
		}
		constrain(returnType, functionType.returnType);
		constrain(functionType.returnType, returnType);

		if(!extractedTypes.has(row.package_name)) {
			extractedTypes.set(row.package_name, new Map());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const packageMap = extractedTypes.get(row.package_name)!;
		if(!packageMap.has(row.function_name)) {
			packageMap.set(row.function_name, []);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		packageMap.get(row.function_name)!.push(functionType);
	}

	const functionTypeInfos = extractedTypes.entries().flatMap(([packageName, map]) => map.entries().map(([functionName, types]) => ({
		name:    functionName,
		package: packageName,
		types:   types
	}))).toArray();
	const unseenSignaturePackageContributionCounts = new Map(unseenSignaturePackageContributions.entries().map(([packageName, signatures]) => [packageName, signatures.size] as const));
	return [functionTypeInfos, unseenSignaturePackageContributionCounts];
}

function typeFromStr(str: string): UnresolvedDataType {
	if(str.startsWith('v<') && str.endsWith('>')) {
		const vectorType = new UnresolvedRAtomicVectorType();
		constrain(vectorType.elementType, typeFromStr(str.slice(2, -1)));
		constrain(typeFromStr(str.slice(2, -1)), vectorType.elementType);
		return vectorType;
	} else if(str === 'function') {
		return new UnresolvedRFunctionType();
	} else if(str === 'list' || str === 'dgCMatrix') {
		return new UnresolvedRListType();
	} else if(str === 'logical') {
		return new RLogicalType();
	} else if(str === 'integer') {
		return new RIntegerType();
	} else if(str === 'double') {
		return new RDoubleType();
	} else if(str === 'complex') {
		return new RComplexType();
	} else if(str === 'character') {
		return new RStringType();
	} else if(str === 'raw') {
		return new RRawType();
	} else if(str === 'NULL') {
		return new RNullType();
	} else if(str === 'formula' || str === 'expression' || str === 'name' || str === 'symbol' || str === 'language' || str === 'call' || str === 'srcfile' || str === '<-' || str === '(' || str === 'if' || str === '{' || str === 'for') {
		return new RLanguageType();
	} else if(str === 'environment') {
		return new REnvironmentType();
	} else if(str === 'S4') {
		// S4 types are not supported yet, so we return a variable type
		return new UnresolvedRTypeVariable();
	} else if(str === 'standardGeneric' || str === 'mle' || str === 'track' || str === 'derivedDefaultMethod' || str === 'jmcmMod' || str === 'glmerMod') {
		// Give Up
		return new UnresolvedRTypeVariable();
	} else {
		throw new Error(`Unknown type: ${str}`);
	}
}