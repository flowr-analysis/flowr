import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append, extractNodeContent } from '../../output'

export type FunctionNameInfo = string

export interface FunctionDefinitionInfo extends FeatureInfo {
  // TODO: scoping/namespaces?
  // TODO: local/global functions etc.
  /** all, anonymous, assigned, non-assigned, ... */
  total:                   number
  /** how many are really using OP-Lambda? */
  lambdasOnly:             number
  /** using `<<-`, `<-`, `=`, `->` `->>` */
  assignedFunctions:       number
  usedParameterNames:      number
  /** anonymous functions invoked directly */
  functionsDirectlyCalled: number
  nestedFunctions:         number
  /** functions that in some easily detectable way call themselves */
  recursive:               number
}

const initialFunctionDefinitionInfo = (): FunctionDefinitionInfo => ({
  total:                   0,
  lambdasOnly:             0,
  assignedFunctions:       0,
  usedParameterNames:      0,
  functionsDirectlyCalled: 0,
  nestedFunctions:         0,
  recursive:               0
})

// TODO: note that this can not work with assign, setGeneric and so on for now
// TODO: is it faster to wrap with count?
const queryAnyFunctionDefinition: Query = xpath.parse(`//FUNCTION`)
const queryAnyLambdaDefinition: Query = xpath.parse(`//OP-LAMBDA`)

// we do not care on how these functions are defined
const queryAssignedFunctionDefinitions: Query = xpath.parse(`
  //LEFT_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //EQ_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //RIGHT_ASSIGN[preceding-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/following-sibling::expr[count(*)=1]/SYMBOL
`)

const queryUsedParameterNames: Query = xpath.parse(`
  //FUNCTION/../SYMBOL_FORMALS
`)

// this is probably not completely correct
const defineFunctionsToBeCalled: Query = xpath.parse(`
  //expr/expr/*[self::FUNCTION or self::OP-LAMBDA]/parent::expr[preceding-sibling::OP-LEFT-PAREN or preceding-sibling::OP-LEFT-BRACE]/parent::expr[following-sibling::OP-LEFT-PAREN]
`)

const nestedFunctionsQuery: Query = xpath.parse(`
  //expr[preceding-sibling::FUNCTION or preceding-sibling::OP-LAMBDA]//*[self::FUNCTION or self::OP-LAMBDA]
`)


// expects to be invoked in the context of the parent function name // TODO: test if it is really invoked or just used in a function definition/quote etc?
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

  process(existing: FunctionDefinitionInfo, input: Document, filepath: string | undefined): FunctionDefinitionInfo {
    const allFunctions = queryAnyFunctionDefinition.select({ node: input }).length
    const allLambdas = queryAnyLambdaDefinition.select({ node: input })

    append(this.name, 'allLambdas', allLambdas, filepath)

    existing.total += allFunctions + allLambdas.length
    existing.lambdasOnly += allLambdas.length

    const usedParameterNames = queryUsedParameterNames.select({ node: input })
    existing.usedParameterNames += usedParameterNames.length
    append(this.name, 'usedParameterNames', usedParameterNames, filepath)

    existing.functionsDirectlyCalled += defineFunctionsToBeCalled.select({ node: input }).length
    existing.nestedFunctions += nestedFunctionsQuery.select({ node: input }).length

    const assignedFunctions = queryAssignedFunctionDefinitions.select({ node: input })
    const assignedNames = assignedFunctions.map(extractNodeContent)
    existing.assignedFunctions += assignedFunctions.length
    append(this.name, 'assignedFunctions', assignedNames, filepath)

    const recursiveFunctions = []
    for(let i = 0; i < assignedFunctions.length; i++) {
      const name = assignedNames[i]
      if(testRecursive(assignedFunctions[i], name)) {
        recursiveFunctions.push(name)
      }
    }
    existing.recursive += recursiveFunctions.length
    append(this.name, 'recursiveFunctions', recursiveFunctions, filepath)

    return existing
  },
  initialValue: initialFunctionDefinitionInfo
}
