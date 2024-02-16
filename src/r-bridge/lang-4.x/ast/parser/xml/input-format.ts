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

export type ParsedCsv = Record<number, CsvEntry>

export interface CsvEntry extends Record<string, unknown> {
	line1:    number,
	col1:     number,
	line2:    number,
	col2:     number,
	id:       number,
	parent:   number,
	token:    string,
	terminal: boolean,
	text:     string
}

export function csvToRecord(csv: string[][]): ParsedCsv {
	const ret: ParsedCsv = []
	const headers = csv[0]
	for(let rowIdx = 1; rowIdx < csv.length; rowIdx++){
		const content: Record<string,string> = {}
		for(let col = 1; col < csv[rowIdx].length; col++){
			// we start at column 1 here, because the 0th column has a second copy of the id that has a dummy header
			// (see https://github.com/Code-Inspect/flowr/issues/653)
			content[headers[col]] = csv[rowIdx][col]
		}
		const entry = content as CsvEntry
		ret[entry.id] = entry
	}
	return ret
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
