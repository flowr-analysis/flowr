import { Feature, FeatureInfo, Query } from '../feature'
import * as xpath from 'xpath-ts2'
import { append } from '../output/statisticsFile'

export interface ControlflowInfo extends FeatureInfo {
  ifThen:                   number
  ifThenElse:               number
  /** can be nested with if-s or if-then-else's */
  nestedIfThen:             number
  nestedIfThenElse:         number
  /** if(TRUE), ... */
  constantIfThen:           number
  constantIfThenElse:       number
  /** if(x), ... */
  singleVariableIfThen:     number
  singleVariableIfThenElse: number
  /** switch(...) */
  switchCase:               number
}

export const initialControlflowInfo = (): ControlflowInfo => ({
  ifThen:                   0,
  ifThenElse:               0,
  nestedIfThen:             0,
  nestedIfThenElse:         0,
  constantIfThen:           0,
  constantIfThenElse:       0,
  singleVariableIfThen:     0,
  singleVariableIfThenElse: 0,
  switchCase:               0
})

const ifThenQuery: Query = xpath.parse(`//IF[not(following-sibling::ELSE)]`)
const ifThenElseQuery: Query = xpath.parse(`//IF[following-sibling::ELSE]`)

const selectCondition: Query = xpath.parse(`..//expr[preceding-sibling::OP-LEFT-PAREN][1]`)
const constantCondition: Query = xpath.parse(`
  ./NUM_CONST
  |
  ./NULL_CONST
  |
  ./STR_CONST
  |
  ./SYMBOL[text() = 'T' or text() = 'F']`)
const singleVariableCondition: Query = xpath.parse(`./SYMBOL[text() != 'T' and text() != 'F']`)

const nestedIfThenQuery: Query = xpath.parse(`..//expr/IF`)

function collectForIfThenOptionalElse(existing: ControlflowInfo, name: 'IfThen' | 'IfThenElse',  ifThenOptionalElse: Node, filepath: string | undefined) {
  // select when condition to check if constant, ...
  const conditions = selectCondition.select({ node: ifThenOptionalElse })

  append(controlflow.name, name, conditions, filepath)

  const constantKey = `constant${name}`
  const constantConditions = conditions.flatMap(c => constantCondition.select({ node: c }))

  existing[constantKey] += constantConditions.length
  append(controlflow.name, constantKey, constantConditions, filepath)

  const singleVariableKey = `singleVariable${name}`
  const singleVariableConditions = conditions.flatMap(c => singleVariableCondition.select({ node: c }))
  existing[singleVariableKey] += singleVariableConditions.length
  append(controlflow.name, singleVariableKey, singleVariableConditions, filepath)

  const nestedKey = `nested${name}`
  const nestedIfThens = nestedIfThenQuery.select({ node: ifThenOptionalElse })

  existing[nestedKey] += nestedIfThens.length
}

export const controlflow: Feature<ControlflowInfo> = {
  name:        'Controlflow',
  description: 'Deals with if-then-else and switch-case',

  process(existing: ControlflowInfo, input: Document, filepath: string | undefined): ControlflowInfo {

    const ifThen = ifThenQuery.select({ node: input })
    const ifThenElse = ifThenElseQuery.select({ node: input })

    existing.ifThen += ifThen.length
    existing.ifThenElse += ifThenElse.length

    ifThen.forEach(ifThen => { collectForIfThenOptionalElse(existing, 'IfThen', ifThen, filepath) })
    ifThenElse.forEach(ifThenElse => { collectForIfThenOptionalElse(existing, 'IfThenElse', ifThenElse, filepath) })

    return existing
  }
}
