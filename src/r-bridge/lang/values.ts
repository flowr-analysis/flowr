import { parse } from 'csv-parse/sync'

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
  throw new Error(`cannot convert value of type ${typeof value} to R code`)
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
  throw new Error(`value ${value} is not a legal R boolean`)
}

export function parseCSV(lines: string[]): string[][] {
  // TODO: make this scalable?
  return parse(lines.join('\n'), { skipEmptyLines: true })
}
