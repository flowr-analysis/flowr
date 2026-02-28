import type { DeepPartial, DeepReadonly, DeepRequired } from 'ts-essentials';
import { jsonReplacer } from './json';

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
		(base).push(...addon);
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
 */
type PathsOfObject<T, Prefix extends string = ''> =
	T extends Primitive | readonly unknown[]
		? never
		: {
			[K in keyof T & string]:
			| `${Prefix}${K}`
			| (T[K] extends Primitive | readonly unknown[]
				? never
				: PathsOfObject<T[K], `${Prefix}${K}.`>)
		}[keyof T & string];

type TypeOfPathInObject<T, P extends string> =
	// If the current value can be undefined, propagate it
	undefined extends T
		? TypeOfPathInObject<Exclude<T, undefined>, P> | undefined
		: P extends `${infer Head}.${infer Tail}`
			? Head extends keyof T
				? TypeOfPathInObject<T[Head], Tail>
				: T extends readonly (infer U)[]
					? Head extends `${number}`
						? TypeOfPathInObject<U, Tail>
						: never
					: never
			: P extends keyof T
				? T[P]
				: T extends readonly (infer U)[]
					? P extends `${number}`
						? U
						: never
					: never;

/**
 * Given an object type `T`, produces a union of string literal types representing all possible paths to primitive values within that object.
 * The {@link ObjectPathValue} type can be used to get the type of the value at a specific path.
 * @example
 */
export type ObjectPath<T> = PathsOfObject<T>;
/**
 * Given an object type `T` and a path `P`, produces the type of the value at that path within the object.
 */
export type ObjectPathValue<T, P extends PathsOfObject<T>> = TypeOfPathInObject<T, P>;

/**
 * This is a version of a deep clone that preserves uncloneable values (like functions, symbols, ...) by keeping the same reference to them.
 */
export function deepClonePreserveUncloneable<T>(obj: T): T {
	if(typeof obj !== 'object' || obj === null) {
		return obj;
	} else if(Array.isArray(obj)) {
		return obj.map(deepClonePreserveUncloneable) as unknown as T;
	} else if(obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as T;
	} else if(obj instanceof Map) {
		return new Map(Array.from(obj.entries()).map(([k, v]) => [deepClonePreserveUncloneable(k), deepClonePreserveUncloneable(v)])) as unknown as T;
	} else if(obj instanceof Set) {
		return new Set(Array.from(obj.values()).map(deepClonePreserveUncloneable)) as unknown as T;
	} else {
		const result: Record<string, unknown> = {};
		for(const key of Object.keys(obj)) {
			result[key] = deepClonePreserveUncloneable((obj as Record<string, unknown>)[key]);
		}
		return result as T;
	}
}