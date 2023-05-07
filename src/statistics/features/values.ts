import { append, Feature, Query } from '../feature'
import { MergeableRecord } from '../../util/objects'
import * as xpath from 'xpath-ts2'
import { RNumHexFloatRegex } from '../../r-bridge/lang:4.x/values'
import { assertUnreachable } from '../../util/assert'

export interface ValueInfo extends MergeableRecord {
  allNumerics:      number,
  imaginaryNumbers: number,
  integers:         number,
  floatHex:         number,

  logical:          number,
  specialConstants: number,
  strings:          number
}

export const initialValueInfo = (): ValueInfo => ({
  allNumerics:      0,
  imaginaryNumbers: 0,
  integers:         0,
  floatHex:         0,

  logical:          0,
  specialConstants: 0,
  strings:          0
})

const numericConstantQuery: Query = xpath.parse(`//NUM_CONST`)
const stringConstantQuery: Query = xpath.parse(`//STR_CONST`)
const specialConstantsQuery: Query = xpath.parse(`//NULL_CONST`)
const shortLogicalSymbolQuery: Query = xpath.parse(`//SYMBOL[text() = 'T' or text() = 'F']`)


function classifyNumericConstants(numeric: string, existing: ValueInfo): 'allNumerics' | 'logical' | 'special-constants' {
  if (numeric === 'TRUE' || numeric === 'FALSE') {
    return 'logical'
  }
  if (numeric === 'NA' || numeric === 'NaN' || numeric === 'NULL' || numeric === 'Inf' || numeric === '-Inf') {
    return 'special-constants'
  }

  if (numeric.includes('i')) {
    existing.imaginaryNumbers++
  } else if (numeric.endsWith('L')) {
    existing.integers++
  } else if (RNumHexFloatRegex.test(numeric)) {
    existing.floatHex++
  }

  return 'allNumerics'
}

export const values: Feature<ValueInfo> = {
  name:        'values',
  description: 'all values used (as constants etc.)',

  append(existing: ValueInfo, input: Document): ValueInfo {
    const strings = stringConstantQuery.select({ node: input})
    const numerics = numericConstantQuery.select({ node: input})
    const specialConstants = specialConstantsQuery.select({ node: input})
    const specialLogicalSymbols = shortLogicalSymbolQuery.select({ node: input})

    const numbers: Node[] = []
    numerics.map(n => [n, classifyNumericConstants(n.textContent ?? '<unknown>', existing)] as const)
      .forEach(([n, type]) => {
        switch (type) {
          case 'allNumerics':
            numbers.push(n); break
          case 'logical':
            specialLogicalSymbols.push(n); break
          case 'special-constants':
            specialConstants.push(n); break
          default:
            assertUnreachable(type)
        }
      })

    existing.strings += strings.length
    existing.allNumerics += numerics.length
    existing.specialConstants += specialConstants.length
    existing.logical += specialLogicalSymbols.length

    append(this.name, 'numeric', numbers)
    append(this.name, 'string', strings)
    append(this.name, 'specialConstant', specialConstants)
    append(this.name, 'logical', specialLogicalSymbols)

    return existing
  },

  toString(data: ValueInfo): string {
    // TODO: separate between unique and total count?
    return `---values-------------
\tstrings:  ${data.strings} times
\tnumerics: ${data.allNumerics} times, ${data.imaginaryNumbers} imaginary, ${data.integers} integer, ${data.floatHex} with float hex
\tlogical:  ${data.logical} times
\tspecial constants: ${data.specialConstants} times
    `
  }
}
