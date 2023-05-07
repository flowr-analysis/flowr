import { append, Feature, formatMap } from '../feature'
import * as xpath from 'xpath-ts2'
import { MergeableRecord } from '../../util/objects'
import { groupCount } from '../../util/arrays'

export type FunctionNameInfo = string

export interface FunctionDefinitionInfo extends MergeableRecord {
  // TODO: scoping/namespaces?
  // TODO: local/global functions etc.
  /** all, anonymous, assigned, non-assigned, ... */
  total:                   number
  /** how many are really using OP-Lambda? */
  lambdasOnly:             number
  /** using `<<-`, `<-`, `=`, `->` `->>` */
  assignedFunctions:       FunctionNameInfo[]
  usedParameterNames:      string[]
  /** anonymous functions invoked directly */
  functionsDirectlyCalled: number
  nestedFunctions:         number
}

export const initialFunctionDefinitionInfo = (): FunctionDefinitionInfo => ({
  total:                   0,
  lambdasOnly:             0,
  assignedFunctions:       [],
  usedParameterNames:      [],
  functionsDirectlyCalled: 0,
  nestedFunctions:         0
})

// TODO: note that this can not work with assign, setGeneric and so on for now
// TODO: is it faster to wrap with count?
const queryAnyFunctionDefinition = xpath.parse(`//FUNCTION`)
const queryAnyLambdaDefinition = xpath.parse(`//OP-LAMBDA`)

// we do not care on how these functions are defined
const queryAssignedFunctionDefinitions = xpath.parse(`
  //LEFT_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //EQ_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //RIGHT_ASSIGN[preceding-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/following-sibling::expr[count(*)=1]/SYMBOL
`)

const queryUsedParameterNames = xpath.parse(`
  //FUNCTION/../SYMBOL_FORMALS
`)

// this is probably not completely correct
const defineFunctionsToBeCalled = xpath.parse(`
  //expr/expr/*[self::FUNCTION or self::OP-LAMBDA]/parent::expr[preceding-sibling::OP-LEFT-PAREN or preceding-sibling::OP-LEFT-BRACE]/parent::expr[following-sibling::OP-LEFT-PAREN]
`)

const nestedFunctionsQuery = xpath.parse(`
  //expr[preceding-sibling::FUNCTION or preceding-sibling::OP-LAMBDA]//*[self::FUNCTION or self::OP-LAMBDA]
`)


export const definedFunctions: Feature<FunctionDefinitionInfo> = {
  name:        'defined functions',
  description: 'all functions defined within the document',

  append(existing: FunctionDefinitionInfo, input: Document): FunctionDefinitionInfo {
    const allFunctions = queryAnyFunctionDefinition.select({ node: input })
    const allLambdas = queryAnyLambdaDefinition.select({ node: input })

    existing.total += allFunctions.length + allLambdas.length
    existing.lambdasOnly += allLambdas.length

    const usedParameterNames = queryUsedParameterNames.select({ node: input })
    append(existing, 'usedParameterNames', usedParameterNames)

    existing.functionsDirectlyCalled += defineFunctionsToBeCalled.select({ node: input }).length
    existing.nestedFunctions += nestedFunctionsQuery.select({ node: input }).length

    const assignedFunctions = queryAssignedFunctionDefinitions.select({ node: input })
    existing.assignedFunctions.push(...new Set(assignedFunctions.map(node => node.textContent ?? '<unknown>')))
    return existing
  },

  toString(data: FunctionDefinitionInfo, details: boolean): string {
    const groupedAssignedFunctions = groupCount(data.assignedFunctions)
    const startingWithDot = [...groupedAssignedFunctions.keys()].filter(key => key.startsWith('.')).length
    const groupedUsedParameterNames = groupCount(data.usedParameterNames)

    return `---defined functions------------
\ttotal: ${data.total} (${data.lambdasOnly} of which are using OP-LAMBDA)
\tfunctions assigned: ${groupedAssignedFunctions.size} (of which ${startingWithDot} start with dot)${formatMap(groupedAssignedFunctions, details)}
\tparameter names: ${groupedUsedParameterNames.size} ${formatMap(groupedUsedParameterNames, details)}
\tfunctions directly called: ${data.functionsDirectlyCalled}
\tnested functions: ${data.nestedFunctions}
`
  }

}
