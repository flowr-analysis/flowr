import { Feature, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { appendStatisticsFile } from '../../output'
import { Writable } from 'ts-essentials'

const initialControlflowInfo = {
	ifThen:                   0,
	ifThenElse:               0,
	/** can be nested with if-s or if-then-else's */
	nestedIfThen:             0,
	nestedIfThenElse:         0,
	/** if(TRUE), ... */
	constantIfThen:           0,
	constantIfThenElse:       0,
	/** if(x), ... */
	singleVariableIfThen:     0,
	singleVariableIfThenElse: 0,
	/** switch(...) */
	switchCase:               0,
	singleVariableSwitchCase: 0,
	constantSwitchCase:       0
}

export type ControlflowInfo = Writable<typeof initialControlflowInfo>


const ifThenQuery: Query = xpath.parse('//IF[not(following-sibling::ELSE)]')
const ifThenElseQuery: Query = xpath.parse('//IF[following-sibling::ELSE]')

const selectCondition: Query = xpath.parse('../expr[preceding-sibling::OP-LEFT-PAREN][1]')
const constantCondition: Query = xpath.parse(`
  ./NUM_CONST
  |
  ./NULL_CONST
  |
  ./STR_CONST
  |
  ./SYMBOL[text() = 'T' or text() = 'F']`)
const singleVariableCondition: Query = xpath.parse('./SYMBOL[text() != \'T\' and text() != \'F\']')

const nestedIfThenQuery: Query = xpath.parse('..//expr/IF')

// directly returns the first argument of switch
const switchQuery: Query = xpath.parse('//SYMBOL_FUNCTION_CALL[text() = \'switch\']/../../expr[preceding-sibling::OP-LEFT-PAREN][1]')



function collectForIfThenOptionalElse(existing: ControlflowInfo, name: 'IfThen' | 'IfThenElse',  ifThenOptionalElse: Node, filepath: string | undefined) {
	// select when condition to check if constant, ...
	const conditions = selectCondition.select({ node: ifThenOptionalElse })

	appendStatisticsFile(controlflow.name, name, conditions, filepath)

	const constantKey = `constant${name}` as keyof ControlflowInfo
	const constantConditions = conditions.flatMap(c => constantCondition.select({ node: c }))

	existing[constantKey] += constantConditions.length
	appendStatisticsFile(controlflow.name, constantKey, constantConditions, filepath)

	const singleVariableKey = `singleVariable${name}` as keyof ControlflowInfo
	const singleVariableConditions = conditions.flatMap(c => singleVariableCondition.select({ node: c }))
	existing[singleVariableKey] += singleVariableConditions.length
	appendStatisticsFile(controlflow.name, singleVariableKey, singleVariableConditions, filepath)

	const nestedKey = `nested${name}` as keyof ControlflowInfo
	const nestedIfThen = nestedIfThenQuery.select({ node: ifThenOptionalElse })

	existing[nestedKey] += nestedIfThen.length
}

export const controlflow: Feature<ControlflowInfo> = {
	name:        'Controlflow',
	description: 'Deals with if-then-else and switch-case',

	process(existing: ControlflowInfo, input: FeatureProcessorInput): ControlflowInfo {

		const ifThen = ifThenQuery.select({ node: input.parsedRAst })
		const ifThenElse = ifThenElseQuery.select({ node: input.parsedRAst })

		existing.ifThen += ifThen.length
		existing.ifThenElse += ifThenElse.length

		ifThen.forEach(ifThen => { collectForIfThenOptionalElse(existing, 'IfThen', ifThen, input.filepath) })
		ifThenElse.forEach(ifThenElse => { collectForIfThenOptionalElse(existing, 'IfThenElse', ifThenElse, input.filepath) })

		const switchCases = switchQuery.select({ node: input.parsedRAst })
		existing.switchCase += switchCases.length
		appendStatisticsFile(controlflow.name, 'switchCase', switchCases, input.filepath)


		const constantSwitchCases = switchCases.flatMap(switchCase =>
			constantCondition.select({ node: switchCase })
		)
		existing.constantSwitchCase += constantSwitchCases.length
		appendStatisticsFile(controlflow.name, 'constantSwitchCase', constantSwitchCases, input.filepath)

		const variableSwitchCases = switchCases.flatMap(switchCase =>
			singleVariableCondition.select({ node: switchCase })
		)
		existing.singleVariableSwitchCase += variableSwitchCases.length
		appendStatisticsFile(controlflow.name, 'variableSwitchCase', variableSwitchCases, input.filepath)

		return existing
	},
	initialValue: initialControlflowInfo
}
