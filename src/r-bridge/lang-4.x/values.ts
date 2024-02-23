import { guard } from '../../util/assert'

class ValueConversionError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ValueConversionError'
	}
}

/**
 * transforms a value to something R can understand (e.g., booleans to TRUE/FALSE)
 */
export function ts2r<T>(value: T): string {
	if(typeof value === 'undefined') {
		return 'NA'
	} else if(typeof value === 'string') {
		return JSON.stringify(value)
	} else if(typeof value === 'number') {
		return value.toString()
	} else if(typeof value === 'boolean') {
		return value ? 'TRUE' : 'FALSE'
	} else if(value === null) {
		return 'NULL'
	} else if(Array.isArray(value)) {
		return `c(${value.map(ts2r).join(', ')})`
	} else if(typeof value === 'object') {
		const obj = Object.entries(value)
			.map(([key, value]) => `${key} = ${ts2r(value)}`)
			.join(', ')
		return `list(${obj})`
	}

	throw new ValueConversionError(`cannot convert value of type ${typeof value} to R code`)
}

/** The R literal for the logical true */
export const RTrue = 'TRUE'
/** The R literal for the logical false */
export const RFalse = 'FALSE'

export function isBoolean(value: string): boolean {
	return value === RTrue || value === RFalse
}

export function boolean2ts(value: string): boolean {
	if(value === RTrue) {
		return true
	} else if(value === RFalse) {
		return false
	}
	throw new ValueConversionError(`value ${value} is not a legal R boolean`)
}

export const RNumHexFloatRegex = /^\s*0x(?<intPart>[0-9a-f]+)?(\.(?<floatPart>[0-9a-f]*))?p(?<exp>[-+]?\d+)\s*$/

function getDecimalPlacesWithRadix(floatPart: string, radix: number): number {
	return [...floatPart].reduce((acc, c, idx) => acc + parseInt(c, radix) / (radix ** (idx + 1)), 0)
}

export const RImaginaryMarker = 'i'
export const RIntegerMarker = 'L'
export const RInf = 'Inf'

export interface RNumberValue {
	num:           number
	/** see {@link RIntegerMarker}, still, R treats 1.1L as numeric and not especially integer */
	markedAsInt:   boolean
	/** see {@link RImaginaryMarker}, compound imaginary numbers are expressions in R */
	complexNumber: boolean
}

export function number2ts(value: string): RNumberValue {
	// check for hexadecimal number with floating point addon which is supported by R but not by JS :/
	let lcValue = value.toLowerCase()
	/* both checks are case-sensitive! */
	const last = value[value.length - 1]
	const markedAsInt = last === RIntegerMarker
	const complexNumber = last === RImaginaryMarker

	if(markedAsInt || complexNumber) {
		lcValue = lcValue.slice(0, -1)
	}

	if(value === RInf) {
		return {
			num: Infinity,
			complexNumber,
			markedAsInt
		}
	}

	const floatHex = lcValue.match(RNumHexFloatRegex)
	if(floatHex == null) {
		return {
			num: Number(lcValue),
			complexNumber,
			markedAsInt
		}
	} else {
		const {
			intPart,
			floatPart,
			exp
		} = floatHex.groups as { intPart: string | undefined, floatPart: string | undefined, exp: string }
		const base = intPart === undefined ? 0 : parseInt(`${intPart}`, 16)
		const floatSuffix = floatPart === undefined ? 0 : getDecimalPlacesWithRadix(floatPart, 16)
		const exponent = parseInt(exp, 10)
		return {
			num: (base + floatSuffix) * Math.pow(2, exponent),
			complexNumber,
			markedAsInt
		}
	}
}

export interface RStringValue {
	str:    string
	/** from the R-language definition a string is either delimited by a pair of single or double quotes */
	quotes: '"' | '\''
	/** a string is raw if prefixed with r */
	flag?:  'raw'
}

/**
 * Convert a valid R string into a {@link RStringValue}.
 *
 * @throws {@link ValueConversionError} if the string has an unknown starting quote
 */
export function string2ts(value: string): RStringValue {
	if(value.length < 2) {
		throw new ValueConversionError(`cannot parse string '${value}' as it is too short`)
	}
	const init = value[0]
	if(init === '"' || init === '\'') {
		return {
			str:    value.slice(1, -1),
			quotes: init
		}
	} else if(init === 'r' || init === 'R' && value.length >= 3) {
		const flags = value[1]
		if(flags === '"' || flags === '\'') {
			return {
				str:    value.slice(2, -1),
				quotes: flags,
				flag:   'raw'
			}
		} else {
			throw new ValueConversionError(`expected string to start with a known quote (' or "), or raw, yet received ${value}`)
		}
	} else {
		throw new ValueConversionError(`expected string to start with a known quote (' or "), or raw, yet received ${value}`)
	}
}

export const RNa = 'NA'
export const RNull = 'NULL'

export function isNA(value: string): value is (typeof RNa) {
	return value === RNa
}


export const getParseDataHeader = ['line1', 'col1', 'line2', 'col2', 'id', 'parent', 'token', 'terminal', 'text']
// TODO: maybe switch to simple split regex and pick array indices?
const rowRegex = /^\s*(?<line1>\d+)\s+(?<col1>\d+)\s+(?<line2>\d+)\s+(?<col2>\d+)\s+(?<id>\d+)\s+(?<parent>\d+)\s+(?<token>\S+)\s+(?<terminal>TRUE|FALSE)\s+(?<text>.*)$/

export type GetParseDataRow = [line1: number, col1: number, line2: number, col2: number, id: number, parent: number, token: string, terminal: string, text: string]

export function parseGetParseData(lines: string | readonly string[]): GetParseDataRow[] {
	const content = typeof lines === 'string' ? lines.split('\n') : lines

	if(content.length === 0 || content[0].trim() === '') {
		return []
	}

	return content.map(line => {
		const match = rowRegex.exec(line)
		guard(match?.groups !== undefined, () => `cannot parse line ${line} as CSV`)
		return [Number(match.groups['line1']), Number(match.groups['col1']), Number(match.groups['line2']), Number(match.groups['col2']), Number(match.groups['id']), Number(match.groups['parent']), match.groups['token'], match.groups['terminal'], match.groups['text']] as const
	})
}
