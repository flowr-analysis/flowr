import { Feature, FeatureProcessorInput, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { appendStatisticsFile, extractNodeContent } from '../../output'
import { Writable } from 'ts-essentials'

export type FunctionNameInfo = string

const initialFunctionDefinitionInfo = {
	/** all, anonymous, assigned, non-assigned, ... */
	total:                   0,
	/** how many are really using OP-Lambda? */
	lambdasOnly:             0,
	/** using `<<-`, `<-`, `=`, `->` `->>` */
	assignedFunctions:       0,
	usedArgumentNames:       0,
	/** anonymous functions invoked directly */
	functionsDirectlyCalled: 0,
	nestedFunctions:         0,
	/** functions that in some easily detectable way call themselves */
	recursive:               0
}

export type FunctionDefinitionInfo = Writable<typeof initialFunctionDefinitionInfo>


// note, that this can not work with assign, setGeneric and so on for now
const queryAnyFunctionDefinition: Query = xpath.parse('//FUNCTION')
const queryAnyLambdaDefinition: Query = xpath.parse('//OP-LAMBDA')

// we do not care on how these functions are defined
const queryAssignedFunctionDefinitions: Query = xpath.parse(`
  //LEFT_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //EQ_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //RIGHT_ASSIGN[preceding-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/following-sibling::expr[count(*)=1]/SYMBOL
`)

const queryUsedArgumentNames: Query = xpath.parse(`
  //FUNCTION/../SYMBOL_FORMALS
`)

// this is probably not completely correct
const defineFunctionsToBeCalled: Query = xpath.parse(`
  //expr/expr/*[self::FUNCTION or self::OP-LAMBDA]/parent::expr[preceding-sibling::OP-LEFT-PAREN or preceding-sibling::OP-LEFT-BRACE]/parent::expr[following-sibling::OP-LEFT-PAREN]
`)

const nestedFunctionsQuery: Query = xpath.parse(`
  //expr[preceding-sibling::FUNCTION or preceding-sibling::OP-LAMBDA]//*[self::FUNCTION or self::OP-LAMBDA]
`)


// expects to be invoked in the context of the parent function name
const functionCallWithNameQuery: Query = xpath.parse(`
  ../following-sibling::expr/*[last()]//SYMBOL_FUNCTION_CALL[text() = $name]
  |
  ../preceding-sibling::expr/*[last()]//SYMBOL_FUNCTION_CALL[text() = $name]
`)
function testRecursive(node: Node, name: string): boolean {
	const result = functionCallWithNameQuery.select({ node, variables: { name } })
	return result.length > 0

}


export const definedFunctions: Feature<FunctionDefinitionInfo> = {
	name:        'Defined Functions',
	description: 'All functions defined within the document',

	process(existing: FunctionDefinitionInfo, input: FeatureProcessorInput): FunctionDefinitionInfo {
		const allFunctions = queryAnyFunctionDefinition.select({ node: input.parsedRAst }).length
		const allLambdas = queryAnyLambdaDefinition.select({ node: input.parsedRAst })

		appendStatisticsFile(this.name, 'allLambdas', allLambdas, input.filepath)

		existing.total += allFunctions + allLambdas.length
		existing.lambdasOnly += allLambdas.length

		const usedArgumentNames = queryUsedArgumentNames.select({ node: input.parsedRAst })
		existing.usedArgumentNames += usedArgumentNames.length
		appendStatisticsFile(this.name, 'usedArgumentNames', usedArgumentNames, input.filepath)

		existing.functionsDirectlyCalled += defineFunctionsToBeCalled.select({ node: input.parsedRAst }).length
		existing.nestedFunctions += nestedFunctionsQuery.select({ node: input.parsedRAst }).length

		const assignedFunctions = queryAssignedFunctionDefinitions.select({ node: input.parsedRAst })
		const assignedNames = assignedFunctions.map(extractNodeContent)
		existing.assignedFunctions += assignedFunctions.length
		appendStatisticsFile(this.name, 'assignedFunctions', assignedNames, input.filepath)

		const recursiveFunctions = []
		for(let i = 0; i < assignedFunctions.length; i++) {
			const name = assignedNames[i]
			if(testRecursive(assignedFunctions[i], name)) {
				recursiveFunctions.push(name)
			}
		}
		existing.recursive += recursiveFunctions.length
		appendStatisticsFile(this.name, 'recursiveFunctions', recursiveFunctions, input.filepath)

		return existing
	},
	initialValue: initialFunctionDefinitionInfo
}
