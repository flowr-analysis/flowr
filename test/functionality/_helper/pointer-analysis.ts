import type { SupportedFlowrCapabilityId } from '../../../src/r-bridge/data/get';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { Q } from '../../../src/search/flowr-search-builder';

export const enum ContainerType {
	List = 'list',
	Vector = 'c',
}

export const enum AccessType {
	DoubleBracket = '[[',
	SingleBracket = '[',
	Dollar = '$',
}

function getClosingBracket(type: AccessType): string {
	switch(type) {
		case AccessType.DoubleBracket:
			return ']]';
		case AccessType.SingleBracket:
			return ']';
		case AccessType.Dollar:
			return '';
	}
}

function getAccessCapability(type: AccessType): SupportedFlowrCapabilityId {
	switch(type) {
		case AccessType.DoubleBracket:
			return 'double-bracket-access';
		case AccessType.SingleBracket:
			return 'single-bracket-access';
		case AccessType.Dollar:
			return 'dollar-access';
	}
}

/**
 * Creates access string.
 *
 * Example for name='numbers', index=1 and type=AccessType.DoubleBracket:
 * ```r
 * numbers[[1]]
 * ```
 */
function createAccess(type: AccessType, name: string, ...indices: number[]): string {
	const closingBracket = getClosingBracket(type);

	let result = name;
	let indexSum = 0;
	for(const index of indices) {
		// Named arguments are indexed starting from 1 so we need to sum the indices to access them
		// [2, 1] -> arg3 or [2][1]
		indexSum += index;
		const indexString = type === AccessType.Dollar ? `arg${indexSum}` : index.toString();
		result += `${type}${indexString}${closingBracket}`;
	}
	return result;
}

/**
 * Creates definition string.
 *
 * Example for values=['1', '2', '3', '4'], container='list' and hasNamedArguments=true:
 * ```r
 * list(arg1 = 1, arg2 = 2, arg3 = 3, arg4 = 4)
 * ```
 */
function createDefinition(type: ContainerType, hasNamedArguments: boolean, ...values: (string | string[])[]): string {
	return definitionHelper(type, hasNamedArguments, 1, ...values);
}

/**
 * Helper function for createDefinition with start index.
 */
function definitionHelper(
	type: ContainerType,
	hasNamedArguments: boolean,
	index: number,
	...values: (string | string[])[]
): string {
	let i = index;
	const parameterList = values
		.map((value) => {
			let valueString: string;
			const thisIndex = i++;
			if(Array.isArray(value)) {
				valueString = definitionHelper(type, hasNamedArguments, i, ...value);
				i += value.length;
			} else {
				valueString = value;
			}

			if(hasNamedArguments) {
				return `arg${thisIndex} = ${valueString}`;
			} else {
				return valueString;
			}
		})
		.join(', ');
	return `${type}(${parameterList})`;
}

function queryArgument(hasNamedArguments: boolean, index: number, value: string, line: number) {
	if(hasNamedArguments) {
		return queryNamedArgument(`arg${index}`, line);
	} else {
		return queryUnnamedArgument(value, line);
	}
}

function queryNamedArgument(name: string, line: number) {
	return { query: Q.varInLine(name, line).filter(RType.Argument) };
}

function queryUnnamedArgument(value: string, line: number) {
	return { query: Q.varInLine(value, line).filter(RType.Number) };
}

function queryAccessInLine(type: AccessType, line: number) {
	return { query: Q.varInLine(type, line) };
}

export function setupContainerFunctions(
	containerType: ContainerType,
	accessType: AccessType,
	hasNamedArguments: boolean
) {
	const acc = (name: string, ...indices: number[]) => createAccess(accessType, name, ...indices);
	const def = (...values: (string | string[])[]) => createDefinition(containerType, hasNamedArguments, ...values);
	const accessCapability = getAccessCapability(accessType);
	const queryArg = (index: number, value: string, line: number) =>
		queryArgument(hasNamedArguments, index, value, line);
	const queryNamedArg = (name: string, line: number) => queryNamedArgument(name, line);
	const queryUnnamedArg = (value: string, line: number) => queryUnnamedArgument(value, line);
	const queryAccInLine = (line: number) => queryAccessInLine(accessType, line);
	return { acc, def, accessCapability, queryArg, queryNamedArg, queryUnnamedArg, queryAccInLine };
}
