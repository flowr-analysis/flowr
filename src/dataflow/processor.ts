/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import { foldAstTwoWay, TwoWayFoldFunctions } from '../r-bridge/lang:4.x/ast/model/processing/twoWayFold'
import { DataflowScopeName } from './graph'
import { DecoratedAst, ParentInformation, RNodeWithParent } from '../r-bridge'
import { DataflowInformation } from './internal/info'

export interface DataflowProcessorDown<OtherInfo> {
  readonly ast: DecoratedAst<OtherInfo>
  scope:        DataflowScopeName
}

export type DataflowProcessorFolds<OtherInfo> = Omit<TwoWayFoldFunctions<OtherInfo, DataflowProcessorDown<OtherInfo>, DataflowInformation<OtherInfo>>, 'down'>

export function dataflowFold<OtherInfo>(ast: RNodeWithParent<OtherInfo>,
                                        initial: DataflowProcessorDown<OtherInfo & ParentInformation>,
                                        folds: DataflowProcessorFolds<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo & ParentInformation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- just so we do not have to re-create
  const twoWayFolds: any = folds
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  twoWayFolds.down = down
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return foldAstTwoWay(ast, initial, twoWayFolds)
}

function down<OtherInfo>(_node: RNodeWithParent<OtherInfo & ParentInformation>, down: DataflowProcessorDown<OtherInfo & ParentInformation>): DataflowProcessorDown<OtherInfo & ParentInformation> {
  // TODO: support scope change on functions, nested functions, `assign`, `eval` in env etc.
  return down
}
