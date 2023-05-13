import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { guard } from '../../util/assert'
import { append, extractNodeContent } from '../output/statisticsFile'
import { log } from '../../util/log'

export interface DataAccess extends FeatureInfo {
  singleBracket:               number,
  singleBracketEmpty:          number,
  singleBracketConstant:       number,
  singleBracketSingleVariable: number,
  doubleBracket:               number,
  doubleBracketEmpty:          number,
  doubleBracketConstant:       number,
  doubleBracketSingleVariable: number,
  byName:                      number,
  bySlot:                      number,
  unknown:                     number
}

export const initialDataAccessInfo = (): DataAccess => ({
  singleBracket:               0,
  singleBracketEmpty:          0,
  singleBracketConstant:       0,
  singleBracketSingleVariable: 0,
  doubleBracket:               0,
  doubleBracketEmpty:          0,
  doubleBracketConstant:       0,
  doubleBracketSingleVariable: 0,
  byName:                      0,
  bySlot:                      0,
  unknown:                     0
})

const singleBracketAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::OP-LEFT-BRACKET][1]`)
const doubleBracketAccess: Query = xpath.parse(`//expr/SYMBOL/../../*[preceding-sibling::LBB][1]`)
//  or self::LBB

// TODO: merge with if queries etc?
const constantAccess: Query = xpath.parse(`
  ./NUM_CONST
  |
  ./NULL_CONST
  |
  ./STR_CONST
  |
  ./SYMBOL[text() = 'T' or text() = 'F']`)
const singleVariableAccess: Query = xpath.parse(`./SYMBOL[text() != 'T' and text() != 'F']`)


function processForBracketAccess(existing: DataAccess, nodes: Node[], access: 'singleBracket' | 'doubleBracket', filepath: string | undefined) {
// we use the parent node to get more information in the output if applicable
  append(dataAccess.name, access, nodes.map(n => n.parentNode ?? n), filepath)

  existing[access] += nodes.length
  const constantAccesses = nodes.flatMap(n => constantAccess.select({ node: n }))
  const singleVariableAccesses = nodes.flatMap(n => singleVariableAccess.select({ node: n }))

  existing[`${access}Empty`] += nodes.map(extractNodeContent).filter(n => n === ']').length
  existing[`${access}Constant`] += constantAccesses.length
  existing[`${access}SingleVariable`] += singleVariableAccesses.length
}


export const dataAccess: Feature<DataAccess> = {
  name:        'Data Access',
  description: 'Ways of accessing data structures in R',

  process(existing: DataAccess, input: Document, filepath: string | undefined): DataAccess {
    const singleBracketAccesses = singleBracketAccess.select({ node: input })
    const doubleBracketAccesses = doubleBracketAccess.select({ node: input })

    processForBracketAccess(existing, singleBracketAccesses, 'singleBracket', filepath)
    processForBracketAccess(existing, doubleBracketAccesses, 'doubleBracket', filepath)

    return existing
  }
}
