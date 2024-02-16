import type { RawRType } from '../../model'

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

/**
 * Retrieves the given key(s) from the converted xml.
 * Will throw an {@link XmlParseError} if at least one of the keys is not present
 *
 * @typeParam T - the type of the values to retrieve. Note, that this type is not checked at runtime.
 */
export function getKeysGuarded<T extends XmlBasedJsonValue>(obj: XmlBasedJson, key: string): T
export function getKeysGuarded<T extends XmlBasedJsonValue>(obj: XmlBasedJson, ...key: string[]): Record<string, T>
export function getKeysGuarded<T extends XmlBasedJsonValue>(obj: XmlBasedJson, ...key: string[]): (Record<string, T> | T) {
	const keys = Object.keys(obj)

	const check = (key: string): T => {
		if(!keys.includes(key)) {
			throw new XmlParseError(`expected obj to have key ${key}, yet received ${JSON.stringify(obj)}`)
		}
		return obj[key] as T
	}

	if(key.length === 1) {
		return check(key[0])
	} else {
		return key.reduce<Record<string, T>>((acc, key) => {
			acc[key] = check(key)
			return acc
		}, {})
	}
}
