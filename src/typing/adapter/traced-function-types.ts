import type { UnresolvedDataType } from '../subtyping/types';
import { constrain, getParameterTypeFromFunction, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType } from '../subtyping/types';
import { RComplexType, RDoubleType, REnvironmentType, RIntegerType, RLanguageType, RLogicalType, RNullType, RRawType, RStringType } from '../types';
import type { RohdeFunctionTypeInformation } from './interface';

export interface TraceCsvRow {
	readonly packageName:   string;
	readonly functionName:  string;
	readonly argumentTypes: string;
	readonly returnType:    string;
}

export function extractTypesFromTraceData(data: readonly TraceCsvRow[]): [RohdeFunctionTypeInformation[], Map<string, number>] {
	const extractedTypes: Map<string, Map<string, UnresolvedRFunctionType[]>> = new Map();
	const unseenSignaturePackageContributions: Map<string, Set<string>> = new Map();

	for(const row of data) {
		const argumentTypes = row.argumentTypes.split(',').map(str => typeFromStr(str.trim(), true));
		const returnType = typeFromStr(row.returnType.trim());

		const signature = `${row.functionName} : (${row.argumentTypes}) -> ${row.returnType}`;
		if(!unseenSignaturePackageContributions.values().some(set => set.has(signature))) {
			if(!unseenSignaturePackageContributions.has(row.packageName)) {
				unseenSignaturePackageContributions.set(row.packageName, new Set([signature]));
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				unseenSignaturePackageContributions.get(row.packageName)!.add(signature);
			}
		}

		const functionType = new UnresolvedRFunctionType();
		for(const [index, type] of argumentTypes.entries()) {
			constrain(getParameterTypeFromFunction(functionType, index), type);
		}
		constrain(returnType, functionType.returnType);

		if(!extractedTypes.has(row.packageName)) {
			extractedTypes.set(row.packageName, new Map());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const packageMap = extractedTypes.get(row.packageName)!;
		if(!packageMap.has(row.functionName)) {
			packageMap.set(row.functionName, []);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		packageMap.get(row.functionName)!.push(functionType);
	}

	const functionTypeInfos = extractedTypes.entries().flatMap(([packageName, map]) => map.entries().map(([functionName, types]) => ({
		name:    functionName,
		package: packageName,
		types:   types
	}))).toArray();
	const unseenSignaturePackageContributionCounts = new Map(unseenSignaturePackageContributions.entries().map(([packageName, signatures]) => [packageName, signatures.size] as const));
	return [functionTypeInfos, unseenSignaturePackageContributionCounts];
}

function typeFromStr(str: string, hasNegativePolarity: boolean = false): UnresolvedDataType {
	if(str.startsWith('v<') && str.endsWith('>')) {
		const vectorType = new UnresolvedRAtomicVectorType();
		if(hasNegativePolarity) {
			constrain(vectorType.elementType, typeFromStr(str.slice(2, -1)));
		} else {
			constrain(typeFromStr(str.slice(2, -1)), vectorType.elementType);
		}
		return vectorType;
	} else if(str === 'function') {
		return new UnresolvedRFunctionType();
	} else if(str === 'list') {
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
	} else if(str === 'formula' || str === 'expression' || str === 'name' || str === 'symbol' || str === 'language' || str === 'call') {
		return new RLanguageType();
	} else if(str === 'environment') {
		return new REnvironmentType();
	} else {
		throw new Error(`Unknown type: ${str}`);
	}
}