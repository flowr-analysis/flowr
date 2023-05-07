import { Feature, formatMap } from '../feature'
import { CommentInfo } from './comments'
import * as xpath from 'xpath-ts'
import { MergeableRecord } from '../../util/objects'
import { groupCount } from '../../util/arrays'

export type FunctionNameInfo = string

export interface FunctionDefinitionInfo extends MergeableRecord {
  // TODO: scoping/namespaces?
  // TODO: local/global functions etc.
  functions: FunctionNameInfo[]
}

export const initialFunctionDefinitionInfo = (): FunctionDefinitionInfo => ({
  functions: []
})

// TODO: note that this can not work with assign, setGeneric and so on for now

// we do not care on how these functions are defined
export const queryFunctionDefinitions = xpath.parse(`
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
    const nodes = queryFunctionDefinitions.select({ node: input })
    existing.functions.push(...new Set(nodes.map(node => node.textContent ?? '<unknown>')))
    return existing
  },

  toString(data: FunctionDefinitionInfo): string {
    const groupedFunctions = groupCount(data.functions)
    return `---defined functions------------
\tfunctions defined: ${groupedFunctions.size}${formatMap(groupedFunctions)}
`
  }

}
