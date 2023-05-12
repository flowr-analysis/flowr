import { Feature, FeatureInfo } from '../feature'
import * as xpath from 'xpath-ts2'

export interface ControlflowInfo extends FeatureInfo {
  ifThen:                   number
  ifThenElse:               number
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

const ifThenQuery = xpath.parse(`//IF[not(.//ELSE)]`)

export const controlflow: Feature<ControlflowInfo> = {
  name:        'Controlflow',
  description: 'Deals with if-then-else and switch-case',

  process(existing: ControlflowInfo, input: Document, filepath: string | undefined): ControlflowInfo {

    return existing
  }
}
