import { Feature, formatMap, Query } from '../feature'
import { MergeableRecord } from '../../util/objects'
import * as xpath from 'xpath-ts2'
import { groupCount } from '../../util/arrays'
import { RNumHexFloatRegex } from '../../r-bridge/lang:4.x/values'

export interface ValueInfo extends MergeableRecord {
  numerics:         string[]
  imaginaryNumbers: number,
  integers:         number,
  floatHex:         number,

  logical:          string[]
  specialConstants: string[]
  strings:          string[]
}

export const initialValueInfo = (): ValueInfo => ({
  numerics:         [],
  imaginaryNumbers: 0,
  integers:         0,
  floatHex:         0,

  logical:          [],
  specialConstants: [],
  strings:          []
})

const numericConstantQuery: Query = xpath.parse(`//NUM_CONST`)
const stringConstantQuery: Query = xpath.parse(`//STR_CONST`)
const specialConstantsQuery: Query = xpath.parse(`//NULL_CONST`)
const shortLogicalSymbolQuery: Query = xpath.parse(`//SYMBOL[text() = 'T' or text() = 'F']`)


function classifyNumericConstants(numeric: string, existing: ValueInfo) {
  if (numeric === 'TRUE' || numeric === 'FALSE') {
    existing.logical.push(numeric)
    return
  }
  if (numeric === 'NA' || numeric === 'NaN' || numeric === 'NULL' || numeric === 'Inf' || numeric === '-Inf') {
    existing.specialConstants.push(numeric)
    return
  }

  if (numeric.includes('i')) {
    existing.imaginaryNumbers++
  } else if (numeric.endsWith('L')) {
    existing.integers++
  } else if (RNumHexFloatRegex.test(numeric)) {
    existing.floatHex++
  }

  existing.numerics.push(numeric)
}

export const values: Feature<ValueInfo> = {
  name:        'values',
  description: 'all values used (as constants etc.)',

  append(existing: ValueInfo, input: Document): ValueInfo {
    const strings = stringConstantQuery.select({ node: input}).map(n => n.textContent ?? '<unknown>')
    const numerics = numericConstantQuery.select({ node: input}).map(n => n.textContent ?? '<unknown>')
    const specialConstants = specialConstantsQuery.select({ node: input}).map(n => n.textContent ?? '<unknown>')

    const specialLogicalSymbols = shortLogicalSymbolQuery.select({ node: input}).map(n => n.textContent ?? '<unknown>')
    existing.logical.push(...specialLogicalSymbols)

    existing.strings.push(...strings)
    numerics.forEach(n => classifyNumericConstants(n, existing))
    existing.specialConstants.push(...specialConstants)

    return existing
  },

  toString(data: ValueInfo, details: boolean): string {

    const groupedStrings = groupCount(data.strings)
    const groupedNumeric = groupCount(data.numerics)
    const groupedSpecialConstants = groupCount(data.specialConstants)

    // TODO: separate between unique and total count
    return `---values-------------
\tstrings: (${data.strings.length} times) ${formatMap(groupedStrings, details)}
\tnumerics: (${data.numerics.length} times, ${data.imaginaryNumbers} imaginary, ${data.integers} integer, ${data.floatHex} with float hex)${formatMap(groupedNumeric, details)}
\tlogical: (${data.logical.length} times)${formatMap(groupCount(data.logical), details)}
\tspecial constants: (${data.specialConstants.length} times)${formatMap(groupedSpecialConstants, details)}
    `
  }
}
