import { parse } from 'csv-parse/sync'

/**
 * transforms a value to something R can understand (e.g., booleans to TRUE/FALSE)
 */
export function valueToR (value: any): string {
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
    return `c(${value.map(valueToR).join(', ')})`
  } else if (typeof value === 'object') {
    const obj = Object.entries(value)
      .map(([key, value]) => `${key} = ${valueToR(value)}`)
      .join(', ')
    return `list(${obj})`
  }
  // TODO: bigint, function, ...
  throw new Error(`cannot convert value of type ${typeof value} to R code`)
}

export function parseCSV(lines: string[]): string[][] {
  // TODO: make this scalable?
  return parse(lines.join('\n'), { skipEmptyLines: true })
}
