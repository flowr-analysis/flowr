import { Feature, FeatureProcessorInput } from '../feature'
import { Writable } from 'ts-essentials'
import { isSpecialSymbol, RNodeWithParent, RoleInParent, RType, visitAst } from '../../../r-bridge'
import { guard, isNotUndefined } from '../../../util/assert'
import { appendStatisticsFile } from '../../output'
import { EdgeType } from '../../../dataflow'
import { definedFunctions } from './defined-functions'


const initialVariableInfo = {
	numberOfVariableUses:  0,
	numberOfDefinitions:   0,
	numberOfRedefinitions: 0
}

export type VariableInfo = Writable<typeof initialVariableInfo>


function visitVariables(info: VariableInfo, input: FeatureProcessorInput): void {

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.Symbol || isSpecialSymbol(node)) {
				return
			}

			if(node.info.role === RoleInParent.AssignmentBinaryOperationLhs) {

			}

			info.numberOfVariableUses++

		}
	)

	appendStatisticsFile(definedFunctions.name, 'all-definitions', allDefinitions.map(s => JSON.stringify(s)), input.filepath)
}


export const variables: Feature<VariableInfo> = {
	name:        'Variables',
	description: 'Variable Usage, Assignments, and Redefinitions',

	process(existing: VariableInfo, input: FeatureProcessorInput): VariableInfo {

		return existing
	},

	initialValue: initialVariableInfo
}
