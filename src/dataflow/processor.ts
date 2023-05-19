/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import { foldAstTwoWay, TwoWayFoldFunctions } from '../r-bridge/lang:4.x/ast/model/processing/twoWayFold'
import { DataflowScopeName } from './graph'
import { DecoratedAst, ParentInformation, RNodeWithParent } from '../r-bridge'
import { DeepReadonly } from 'ts-essentials'
import { DataflowInformation } from './internal/info'

export interface DataflowProcessorDown<OtherInfo> {
  readonly ast: DecoratedAst<OtherInfo>
  scope:        DataflowScopeName
}

export type DataflowProcessorFolds<OtherInfo> = Omit<TwoWayFoldFunctions<OtherInfo, DataflowProcessorDown<OtherInfo>, DataflowInformation<OtherInfo>>, 'down'>

export function dataflowFold<OtherInfo>(ast: RNodeWithParent<OtherInfo>,
                                        initial: DataflowProcessorDown<OtherInfo & ParentInformation>,
                                        folds: DataflowProcessorFolds<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo & ParentInformation> {
  const twoWayFolds: DeepReadonly<TwoWayFoldFunctions<OtherInfo & ParentInformation, DataflowProcessorDown<OtherInfo & ParentInformation>, DataflowInformation<OtherInfo & ParentInformation>>> = {
    down,
    ...folds
  }
  return foldAstTwoWay(ast, initial, twoWayFolds)
}

function down<OtherInfo>(_node: RNodeWithParent<OtherInfo & ParentInformation>, down: DataflowProcessorDown<OtherInfo & ParentInformation>): DataflowProcessorDown<OtherInfo & ParentInformation> {
  // TODO: support scope change on functions, nested functions, `assign`, `eval` in env etc.
  return down
}
