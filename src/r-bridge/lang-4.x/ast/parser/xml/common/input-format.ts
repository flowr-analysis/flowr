import type { RawRType } from '../../../model'

export const attributesKey = 'a'
export const childrenKey = 'c'
export const contentKey = '@'
export const nameKey = '#'

/**
 * Thrown if the given input xml is not valid/contains unexpected elements.
 */
export class XmlParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'XmlParseError'
	}
}

/**
 * represents json format retrieved from processing the xml input
 */
export type XmlBasedJson = Record<string, XmlBasedJsonValue>
/**
 * A xml element in the json can either link to a string or another xml element
 */
export type XmlBasedJsonValue = string | Record<string, unknown> | XmlBasedJson[]

/**
 * We expect all xml elements to have a name attached which represents their R token type.
 */
export interface NamedXmlBasedJson {
	/** corresponds to the R token type */
	name:    RawRType,
	/** remaining content (e.g., children, ...) */
	content: XmlBasedJson
}


function error(key: string, obj: XmlBasedJson) {
	throw new XmlParseError(`expected obj to have key ${key}, yet received ${JSON.stringify(obj)}`)
}

/**
 * Single-key variant of {@link getKeysGuarded}. Will throw an {@link XmlParseError} if the key is not present.
 */
export function getKeyGuarded<T extends XmlBasedJsonValue>(obj: XmlBasedJson, key: string): T {
	const res = obj[key]
	if(res === undefined) {
		error(key, obj)
	}
	return res as T
}

/**
 * Retrieves the given keys from the converted xml. For a single key, see {@link getKeyGuarded}.
 * Will throw an {@link XmlParseError} if at least one of the keys is not present
 *
 * @typeParam T - the type of the values to retrieve. Note, that this type is not checked at runtime.
 */
export function getKeysGuarded<T extends XmlBasedJsonValue>(obj: XmlBasedJson, ...keys: string[]): Record<string, T> {
	const out = {} as Record<string, T>
	for(const k of keys) {
		out[k] = getKeyGuarded(obj, k)
	}
	return out
}
