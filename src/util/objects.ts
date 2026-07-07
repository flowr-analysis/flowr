import type { DeepPartial, DeepReadonly, DeepRequired } from 'ts-essentials';
import { jsonReplacer } from './json';
import { expensiveTrace } from './log';
import type { ILogObj, Logger } from 'tslog';
import { FlowrFilter } from '../search/flowr-search-filters';

/**
 * checks if `item` is an object (it may be an array, ...)
 */
export function isObjectOrArray(item: unknown): boolean {
	return typeof item === 'object';
}

export type MergeableRecord = Record<string, unknown>;
export type MergeableArray = unknown[];
export type Mergeable = MergeableRecord | MergeableArray;
type OrReadonly<T> = T | Readonly<T> | DeepReadonly<T>;

/**
 * Given two objects deeply merges them, if an object is an array it will merge the array values!
 * Guarantees some type safety by requiring objects to merge to be from the same type (allows undefined)
 * @see {@link deepMergeObjectInPlace} to merge into an existing object
 */
export function deepMergeObject<T extends Mergeable>(base: Required<OrReadonly<T>>, addon?: T | DeepPartial<T> | Partial<T>): Required<T>;
export function deepMergeObject<T extends Mergeable>(base: DeepRequired<OrReadonly<T>>, addon?: T | DeepPartial<T> | Partial<T>): DeepRequired<T>;
export function deepMergeObject<T extends Mergeable>(base: OrReadonly<T>, addon?: DeepPartial<T> | Partial<T>): T;
export function deepMergeObject(base: Mergeable, addon: Mergeable): Mergeable;
export function deepMergeObject(base?: Mergeable, addon?: Mergeable): Mergeable | undefined;
export function deepMergeObject(base?: Mergeable, addon?: Mergeable): Mergeable | undefined {
	if(!base) {
		return addon;
	} else if(!addon) {
		return base;
	} else if(typeof base !== 'object' || typeof addon !== 'object') {
		// this case should be guarded by type guards, but in case we do not know
		throw new Error('illegal types for deepMergeObject!');
	}

	assertSameType(base, addon);

	const result: MergeableRecord = { ...base };

	const baseIsArray = Array.isArray(base);
	const addonIsArray = Array.isArray(addon);

	if(!baseIsArray && !addonIsArray) {
		deepMergeObjectWithResult(addon, base, result);
	} else if(baseIsArray && addonIsArray) {
		return base.concat(addon);
	} else {
		throw new Error('cannot merge object with array!');
	}

	return result;
}

function deepMergeObjectWithResult(addon: MergeableRecord, base: MergeableRecord, result: MergeableRecord): void {
	for(const key of Object.keys(addon)) {
		// values that are undefined (like from a partial object) should NOT be overwritten
		if(addon[key] === undefined) {
			continue;
		}

		if(typeof addon[key] === 'object') {
			if(key in base) {
				result[key] = deepMergeObject(base[key] as Mergeable, addon[key] as Mergeable);
			} else {
				result[key] = addon[key];
			}
		} else {
			assertSameType(result[key], addon[key]);
			result[key] = addon[key];
		}
	}
}

/**
 * Given two objects deeply merges them, if an object is an array it will merge the array values!
 * Modifies the `base` object in place and also returns it.
 * Guarantees some type safety by requiring objects to merge to be from the same type (allows undefined)
 * @see {@link deepMergeObject} to create a new merged object
 */
export function deepMergeObjectInPlace<T extends Mergeable>(base: T, addon?: DeepPartial<T> | Partial<T>): T;
export function deepMergeObjectInPlace<T extends Mergeable>(base: T | undefined, addon?: DeepPartial<T> | Partial<T>): T | undefined;
export function deepMergeObjectInPlace(base?: Mergeable, addon?: Mergeable): Mergeable | undefined {
	if(!base) {
		return addon;
	} else if(!addon) {
		return base;
	} else if(typeof base !== 'object' || typeof addon !== 'object') {
		// this case should be guarded by type guards, but in case we do not know
		throw new Error('illegal types for deepMergeObjectInPlace!');
	}

	assertSameType(base, addon);

	const baseIsArray = Array.isArray(base);
	const addonIsArray = Array.isArray(addon);

	if(!baseIsArray && !addonIsArray) {
		deepMergeObjectWithResult(addon, base, base);
	} else if(baseIsArray && addonIsArray) {
		for(const item of addon) {
			(base as unknown[]).push(item);
		}
	} else {
		throw new Error('cannot merge object with array!');
	}

	return base;
}

function assertSameType(base: unknown, addon: unknown): void {
	if(base !== undefined && addon !== undefined && typeof base !== typeof addon) {
		throw new Error(`cannot merge different types! ${typeof base} (${JSON.stringify(base, jsonReplacer)}) !== ${typeof addon} (${JSON.stringify(addon, jsonReplacer)})`);
	}
}

type Defined<T> = Exclude<T, undefined>;
type DefinedRecord<T> = {
	[K in keyof T as T[K] extends undefined ? never : K]: Defined<T[K]>;
};

export function compactRecord<T extends Record<string, unknown>>(record: T): DefinedRecord<T>;
export function compactRecord(record: undefined): undefined;
export function compactRecord<T extends Record<string, unknown>>(record: T | undefined): DefinedRecord<T> | undefined;
/** from a record take only the keys that are not undefined */
export function compactRecord<T extends Record<string, unknown>>(record: T | undefined): DefinedRecord<T> | undefined {
	if(record === undefined) {
		return undefined;
	}
	const result: Partial<Record<string, unknown>> = {};
	for(const key of Object.keys(record)) {
		if(record[key] !== undefined) {
			result[key] = record[key];
		}
	}
	return result as DefinedRecord<T>;
}

type Primitive =
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined
	| Date
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	| Function;

/**
 * Given an object type `T`, produces a union of string literal types representing all possible paths to primitive values within that object.
 * Sadly, right now, the ts-essential paths property breaks when it comes to deeper nested objects
 */
export type AutocompletablePaths<T, Prefix extends string = ''> =
	T extends Primitive | readonly unknown[]
		? never
		: {
			[K in keyof T & string]:
			| `${Prefix}${K}`
			| (T[K] extends Primitive | readonly unknown[]
				? never
				: AutocompletablePaths<T[K], `${Prefix}${K}.`>)
		}[keyof T & string];

/**
 * This is a version of a deep clone that preserves unclonable values (like functions, symbols, ...) by keeping the same reference to them.
 */
export function deepClonePreserveUnclonable<T>(obj: T): T {
	if(typeof obj !== 'object' || obj === null) {
		return obj;
	} else if(Array.isArray(obj)) {
		return obj.map(deepClonePreserveUnclonable) as unknown as T;
	} else if(obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as T;
	} else if(obj instanceof Map) {
		return new Map(obj.entries().map(([k, v]) => [deepClonePreserveUnclonable(k), deepClonePreserveUnclonable(v)])) as unknown as T;
	} else if(obj instanceof Set) {
		return new Set(obj.values().map(deepClonePreserveUnclonable)) as unknown as T;
	} else {
		const result: Record<string, unknown> = {};
		for(const key of Object.keys(obj)) {
			result[key] = deepClonePreserveUnclonable((obj as Record<string, unknown>)[key]);
		}
		return result as T;
	}
}

/**
 * Compares the two passed objects deeply using the loose comparison system designed for the {@link FlowrFilter.MatchesEnrichment}. For this system in use, see {@link FlowrFilter.MatchesEnrichment} in use.
 * @param obj - The real object which we want to test against.
 * @param expected - The object to test the real value {@link obj} against, which should be an object in the shape of {@link obj} with each value to test for replaced by a {@link RegExp} or value to match against. The test will pass if the partial structure matches and the value at each {@link RegExp}, string or primitive location matches the corresponding regular expression. For array entries, {@link arrayMatch} determines whether every element in the array has to match the given expected value, or only some.
 * @param arrayMatch - For array entries, the expected value in {@link test} is compared against each array entry in the real value. This property determines whether every element in the array has to match, or only some. If unset, this defaults to `some`.
 * @param logger - The logger to use for trace debugging.
 */
export function looselyCompareObjects(obj: Record<string, unknown>, expected: Record<string, unknown>, arrayMatch?: 'some' | 'every', logger?: Logger<ILogObj>): boolean {
	expensiveTrace(logger, () => `Comparing ${JSON.stringify(obj)} against ${JSON.stringify(expected)}`);

	for(const [expectedKey, expectedValue] of Object.entries(expected)) {
		const realValue = obj[expectedKey];
		if(!realValue) {
			expensiveTrace(logger, () => `Real value ${JSON.stringify(realValue)} does not exist for expected key ${expectedKey}`);
			return false;
		}

		if(Array.isArray(realValue)) {
			const match = typeof expectedValue === 'object' ? expectedValue instanceof RegExp ?
			// if we expect a regular expression but an array is supplied, test each value
				(value: unknown) => expectedValue.test(typeof value === 'string' ? value : String(value)) :
			// if we expect an object that is not a regular expression, match against our expected structure
				(value: unknown) => looselyCompareObjects(value as Record<string, unknown>, expectedValue as Record<string, unknown>, arrayMatch, logger) :
				// in any other case (primitives!), match against the exact value
				(value: unknown) => expectedValue === value;
			if(!(arrayMatch === 'every' ? realValue.every(match) : realValue.some(match))) {
				expensiveTrace(logger, () => `Array ${JSON.stringify(realValue)} does not match expected value ${JSON.stringify(expectedValue)} (array match ${arrayMatch})`);
				return false;
			}
		} else if(typeof realValue === 'object') {
			// for objects, we recursively match
			if(!looselyCompareObjects(realValue as Record<string, unknown>, expectedValue as Record<string, unknown>, arrayMatch, logger)) {
				expensiveTrace(logger, () => `Object ${JSON.stringify(realValue)} does not match expected object ${JSON.stringify(expectedValue)}`);
				return false;
			}
		}

		// for anything else, we match with our regular expression or string
		if(expectedValue instanceof RegExp) {
			if(!expectedValue.test(typeof realValue === 'string' ? realValue : String(realValue as unknown))) {
				expensiveTrace(logger, () => `Value ${JSON.stringify(realValue)} does not match expected regular expression ${expectedValue}`);
				return false;
			}
		} else if(typeof expectedValue !== 'object') {
			if(expectedValue !== realValue) {
				expensiveTrace(logger, () => `Value ${JSON.stringify(realValue)} does not match expected string ${JSON.stringify(expectedValue)}`);
				return false;
			}
		}
	}

	expensiveTrace(logger, () => `Object ${JSON.stringify(obj)} matches ${JSON.stringify(expected)}`);
	return true;
}
