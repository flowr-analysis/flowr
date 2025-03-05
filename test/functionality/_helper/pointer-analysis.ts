import type { SupportedFlowrCapabilityId } from '../../../src/r-bridge/data/get';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import type { FlowrSearchBuilder, FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import { Q } from '../../../src/search/flowr-search-builder';

/**
 * Type of container. Maps to R container creation functions.
 */
export const enum ContainerType {
	List = 'list',
	Vector = 'c',
}

/**
 * Access type for containers. Maps to R access functions.
 */
export const enum AccessType {
	DoubleBracket = '[[',
	SingleBracket = '[',
	Dollar = '$',
}

/**
 * Returns the closing bracket for the given access type.
 *
 * @param type - Access type
 * @returns Closing bracket
 */
function getClosingBracket(type: AccessType): string {
	switch(type) {
		case AccessType.DoubleBracket:
			return ']]';
		case AccessType.SingleBracket:
			return ']';
		case AccessType.Dollar:
			return '';
		default: {
			const ex: never = type;
			throw new Error(`Unknown access type: ${ex as string}`);
		}
	}
}

/**
 * Returns the capability for the given access type.
 *
 * @param type - Access type
 * @returns Capability ID
 */
function getAccessCapability(type: AccessType): SupportedFlowrCapabilityId {
	switch(type) {
		case AccessType.DoubleBracket:
			return 'double-bracket-access';
		case AccessType.SingleBracket:
			return 'single-bracket-access';
		case AccessType.Dollar:
			return 'dollar-access';
		default: {
			const ex: never = type;
			throw new Error(`Unknown access type: ${ex as string}`);
		}
	}
}

/**
 * Creates access string.
 *
 * Example for name='numbers', index=1 and type={@link AccessType.DoubleBracket}:
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

function createSimpleAccess(type: AccessType, name: string, index: string | number): string {
	const closingBracket = getClosingBracket(type);
	const indexString = Number.isNaN(Number(index)) ? index : `arg${index}`;
	return `${name}${type}${indexString}${closingBracket}`;
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
 * Helper function for {@link createDefinition} with start index.
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

/**
 * Queries an argument in a specific line.
 *
 * Depending on {@link hasNamedArguments}, either {@link queryNamedArgument} or {@link queryUnnamedArgument} is used.
 *
 * @param hasNamedArguments - Whether arguments are named
 * @param index - Argument index
 * @param value - Argument value
 * @param line - Line number
 * @returns Query object
 */
function queryArgument(hasNamedArguments: boolean, index: number, value: string, line: number) {
	if(hasNamedArguments) {
		return queryNamedArgument(`arg${index}`, line);
	} else {
		return queryUnnamedArgument(value, line);
	}
}

/**
 * Queries a named argument in a specific line.
 *
 * Example for name='arg1' and line=1:
 * ```r
 * a <- list(arg1 = 1)
 * # queries first parameter 'arg1 = 1'
 * ```
 *
 * @param name - Argument name
 * @param line - Line number
 * @returns Query object
 */
function queryNamedArgument(name: string, line: number) {
	return { query: Q.varInLine(name, line).filter(RType.Argument) };
}

/**
 * Queries an unnamed argument in a specific line.
 *
 * Example for value='1' and line=1:
 * ```r
 * a <- list(1, 2)
 * # queries first parameter '1'
 * ```
 *
 * @param value - Argument value
 * @param line - Line number
 * @returns Query object
 */
function queryUnnamedArgument(value: string, line: number) {
	return { query: Q.varInLine(value, line).filter(RType.Number) };
}

/**
 * Queries an access in a specific line.
 *
 * Example for type={@link AccessType.Dollar} and line=1:
 * ```r
 * print(a$b$c)
 * # queries 'a$b'
 * ```
 * To query the last access, use `last()`:
 * ```ts
 * queryAccInLine(AccessType.Dollar, 1, query => query.last())
 * ```
 *
 * @param type - Access type
 * @param line - Line number
 * @param fn - Optional function to modify the query, default is identity function
 * @returns Query object
 */
function queryAccessInLine(
	type: AccessType,
	line: number,
	fn: ((query: FlowrSearchBuilder<'get'>) => FlowrSearchLike) | undefined = (query) => query
) {
	return { query: fn(Q.varInLine(type, line)) };
}

export function setupContainerFunctions(
	containerType: ContainerType,
	accessType: AccessType,
	hasNamedArguments: boolean
) {
	/** {@link createAccess} */
	const acc = (name: string, ...indices: number[]) => createAccess(accessType, name, ...indices);
	/** {@link createSimpleAccess} */
	const accS = (name: string, index: string | number) => createSimpleAccess(accessType, name, index);
	/** {@link createDefinition} */
	const def = (...values: (string | string[])[]) => createDefinition(containerType, hasNamedArguments, ...values);
	/** {@link getAccessCapability} */
	const accessCapability = getAccessCapability(accessType);
	/** {@link queryArgument} */
	const queryArg = (index: number, value: string, line: number) =>
		queryArgument(hasNamedArguments, index, value, line);
	/** {@link queryNamedArgument} */
	const queryNamedArg = (name: string, line: number) => queryNamedArgument(name, line);
	/** {@link queryUnnamedArgument} */
	const queryUnnamedArg = (value: string, line: number) => queryUnnamedArgument(value, line);
	/** {@link queryAccessInLine} */
	const queryAccInLine = (
		line: number,
		fn: ((query: FlowrSearchBuilder<'get'>) => FlowrSearchLike) | undefined = undefined
	) => queryAccessInLine(accessType, line, fn);
	return { acc, accS, def, accessCapability, queryArg, queryNamedArg, queryUnnamedArg, queryAccInLine };
}
