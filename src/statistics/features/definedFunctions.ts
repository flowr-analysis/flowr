import { Feature, formatMap } from '../feature'
import { MergeableRecord } from '../../util/objects'
import { groupCount } from '../../util/arrays'
import { xpath } from '../../util/xpath'

export type FunctionNameInfo = string

export interface FunctionDefinitionInfo extends MergeableRecord {
  // TODO: scoping/namespaces?
  // TODO: local/global functions etc.
  /** all, anonymous, assigned, non-assigned, ... */
  total:             number
  /** how many are really using OP-Lambda? */
  lambdasOnly:       number
  /** using `<<-`, `<-`, `=`, `->` `->>` */
  assignedFunctions: FunctionNameInfo[]
}

export const initialFunctionDefinitionInfo = (): FunctionDefinitionInfo => ({
  total:             0,
  lambdasOnly:       0,
  assignedFunctions: []
})

// TODO: note that this can not work with assign, setGeneric and so on for now
// TODO: is it fater to wrap with count?
export const queryAnyFunctionDefinition = new XPathEvaluator().createExpression(`//FUNCTION`)
export const queryAnyLambdaDefinition = xpath.parse(`//OP-LAMBDA`)

// we do not care on how these functions are defined
export const queryAssignedFunctionDefinitions = xpath.parse(`
  //LEFT_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //EQ_ASSIGN[following-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/preceding-sibling::expr[count(*)=1]/SYMBOL
  |
  //RIGHT_ASSIGN[preceding-sibling::expr/*[self::FUNCTION or self::OP-LAMBDA]]/following-sibling::expr[count(*)=1]/SYMBOL
`)

export const definedFunctions: Feature<FunctionDefinitionInfo> = {
  name:        'defined functions',
  description: 'all functions defined within the document',

  append(existing: FunctionDefinitionInfo, input: Document): FunctionDefinitionInfo {
    const allFunctions = xpath.queryCount(queryAnyFunctionDefinition, input)
    const allLambdas = xpath.queryCount(queryAnyLambdaDefinition, input)

    existing.total += allFunctions + allLambdas

    const assignedFunctions = xpath.queryAllContent(queryAssignedFunctionDefinitions, input, '<unknown>')
    existing.assignedFunctions.push(...new Set(assignedFunctions))
    return existing
  },

  toString(data: FunctionDefinitionInfo): string {
    const groupedFunctions = groupCount(data.assignedFunctions)
    return `---defined functions------------
\tfunctions defined: ${groupedFunctions.size}${formatMap(groupedFunctions)}
`
  }

}
