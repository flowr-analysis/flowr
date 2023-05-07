import { Feature, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { MergeableRecord } from '../../util/objects'
import { append } from '../statisticsFile'

export type FunctionNameInfo = string

export interface FunctionDefinitionInfo extends MergeableRecord {
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
}

export const initialFunctionDefinitionInfo = (): FunctionDefinitionInfo => ({
  total:                   0,
  lambdasOnly:             0,
  assignedFunctions:       0,
  usedParameterNames:      0,
  functionsDirectlyCalled: 0,
  nestedFunctions:         0
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


export const definedFunctions: Feature<FunctionDefinitionInfo> = {
  name:        'Defined Functions',
  description: 'all functions defined within the document',

  append(existing: FunctionDefinitionInfo, input: Document): FunctionDefinitionInfo {
    const allFunctions = queryAnyFunctionDefinition.select({ node: input }).length
    const allLambdas = queryAnyLambdaDefinition.select({ node: input }).length

    existing.total += allFunctions + allLambdas
    existing.lambdasOnly += allLambdas

    const usedParameterNames = queryUsedParameterNames.select({ node: input })
    existing.usedParameterNames += usedParameterNames.length
    append(this.name, 'usedParameterNames', usedParameterNames)

    existing.functionsDirectlyCalled += defineFunctionsToBeCalled.select({ node: input }).length
    existing.nestedFunctions += nestedFunctionsQuery.select({ node: input }).length

    const assignedFunctions = queryAssignedFunctionDefinitions.select({ node: input })
    existing.assignedFunctions += assignedFunctions.length
    append(this.name, 'assignedFunctions', assignedFunctions)

    return existing
  },

  toString(data: FunctionDefinitionInfo): string {
    return `---defined functions------------
\ttotal: ${data.total} (${data.lambdasOnly} of which are using OP-LAMBDA)
\t\tfunctions assigned:        ${data.assignedFunctions}
\t\tparameter names:           ${data.usedParameterNames}
\t\tfunctions directly called: ${data.functionsDirectlyCalled}
\t\tnested functions:          ${data.nestedFunctions}
`
  }

}
