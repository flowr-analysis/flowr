import { Feature, FeatureInfo, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { RNumHexFloatRegex } from '../../../r-bridge'
import { assertUnreachable } from '../../../util/assert'
import { append } from '../../output'

export interface ValueInfo extends FeatureInfo {
	allNumerics:      number,
	imaginaryNumbers: number,
	integers:         number,
	floatHex:         number,

	logical:          number,
	specialConstants: number,
	strings:          number
}

const initialValueInfo = (): ValueInfo => ({
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
	if(numeric === 'TRUE' || numeric === 'FALSE') {
		return 'logical'
	}
	if(numeric === 'NA' || numeric === 'NaN' || numeric === 'NULL' || numeric === 'Inf' || numeric === '-Inf') {
		return 'special-constants'
	}

	if(numeric.includes('i')) {
		existing.imaginaryNumbers++
	} else if(numeric.endsWith('L')) {
		existing.integers++
	} else if(RNumHexFloatRegex.test(numeric)) {
		existing.floatHex++
	}

	return 'allNumerics'
}

export const values: Feature<ValueInfo> = {
	name:        'Values',
	description: 'All values used (as constants etc.)',

	process(existing: ValueInfo, input: FeatureProcessorInput): ValueInfo {
		const strings = stringConstantQuery.select({ node: input.parsedRAst })
		const numerics = numericConstantQuery.select({ node: input.parsedRAst })
		const specialConstants = specialConstantsQuery.select({ node: input.parsedRAst })
		const specialLogicalSymbols = shortLogicalSymbolQuery.select({ node: input.parsedRAst })

		const numbers: Node[] = []
		numerics.map(n => [n, classifyNumericConstants(n.textContent ?? '<unknown>', existing)] as const)
			.forEach(([n, type]) => {
				switch(type) {
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

		append(this.name, 'numeric', numbers, input.filepath)
		append(this.name, 'string', strings, input.filepath)
		append(this.name, 'specialConstant', specialConstants, input.filepath)
		append(this.name, 'logical', specialLogicalSymbols, input.filepath)

		return existing
	},
	initialValue: initialValueInfo
}
