import { parse } from 'csv-parse/sync'

class ValueConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValueConversionError'
  }
}

/**
 * transforms a value to something R can understand (e.g., booleans to TRUE/FALSE)
 */
export function ts2r (value: any): string {
  if (typeof value === 'undefined') {
    return 'NA'
  } else if (typeof value === 'string') {
    return `"${value}"`
  } else if (typeof value === 'number') {
    // TODO: deal with infinity and NaN
    return value.toString()
  } else if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  } else if (value === null) {
    return 'NULL'
  } else if (Array.isArray(value)) {
    return `c(${value.map(ts2r).join(', ')})`
  } else if (typeof value === 'object') {
    const obj = Object.entries(value)
      .map(([key, value]) => `${key} = ${ts2r(value)}`)
      .join(', ')
    return `list(${obj})`
  }
  // TODO: bigint, function, ...
  throw new ValueConversionError(`cannot convert value of type ${typeof value} to R code`)
}

const RTrue = 'TRUE'
const RFalse = 'FALSE'

export function isBoolean(value: string): boolean {
  return value === RTrue || value === RFalse
}

export function boolean2ts (value: string): boolean {
  if (value === RTrue) {
    return true
  } else if (value === RFalse) {
    return false
  }
  throw new ValueConversionError(`value ${value} is not a legal R boolean`)
}
const RNumHexFloatRegex = /^\s*0x(?<intpart>[0-9a-f]+)?(\.(?<floatpart>[0-9a-f]*))?p(?<exp>-?\d+)\s*$/

// TODO: deal with NA etc!
function getDecimalPlacesWithRadix(floatpart: string, radix: number): number {
  return [...floatpart].reduce((acc, c, idx) => acc + parseInt(c, radix) / (radix ** (idx + 1)), 0)
}

export const RImaginaryMarker = 'i'
export const RIntegerMarker = 'L'

export interface RNumberValue {
  num: number
  /** see {@link RIntegerMarker}, still, R treats 1.1L as numeric and not especially integer */
  markedAsInt: boolean
  /** see {@link RImaginaryMarker}, compound imaginary numbers are expressions in R */
  complexNumber: boolean
}

export function number2ts(value: string): RNumberValue {
  // TODO: check for legality? even though R should have done that already

  // check for hexadecmial number with floating point addon which is supported by R but not by JS :/
  let lcValue = value.toLowerCase()
  /* both checks are case-sensitive! */
  const last = value[value.length - 1]
  const markedAsInt = last === RIntegerMarker
  const complexNumber = last === RImaginaryMarker

  if (markedAsInt || complexNumber) {
    lcValue = lcValue.slice(0, -1)
  }

  const floatHex = lcValue.match(RNumHexFloatRegex)
  if (floatHex == null) {
    return { num: Number(lcValue), complexNumber, markedAsInt }
  } else {
    const { intpart, floatpart, exp } = floatHex.groups as { intpart: string | undefined, floatpart: string | undefined, exp: string }
    const base = intpart === undefined ? 0 : parseInt(`${intpart}`, 16)
    const floatSuffix = floatpart === undefined ? 0 : getDecimalPlacesWithRadix(floatpart, 16)
    const exponent = parseInt(exp, 10)
    return { num: (base + floatSuffix) * Math.pow(2, exponent), complexNumber, markedAsInt }
  }
}

export interface RStringValue {
  str: string
  // from the R-language definition a string is either delimited by a pair of single or double quotes
  quotes: '"' | "'"
}

export function string2ts(value: string): RStringValue {
  if (value.length < 2) {
    throw new ValueConversionError(`cannot parse string '${value}' as it is too short`)
  }
  const quotes = value[0]
  if (quotes !== '"' && quotes !== "'") {
    throw new ValueConversionError(`expected string to start with a known quote (' or "), yet received ${value}`)
  }
  return { str: value.slice(1, -1), quotes }
}

export function parseCSV(lines: string[]): string[][] {
  // TODO: make this scalable?
  return parse(lines.join('\n'), { skipEmptyLines: true })
}
