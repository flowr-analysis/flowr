/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import { foldAstStateful, StatefulFoldFunctions } from '../r-bridge/lang:4.x/ast/model/processing/statefulFold'
import { DataflowScopeName } from './graph'
import { DecoratedAst, ParentInformation, RNodeWithParent } from '../r-bridge'
import { DataflowInformation } from './internal/info'
import { REnvironmentInformation } from './environments'

export interface DataflowProcessorDown<OtherInfo> {
  readonly ast: DecoratedAst<OtherInfo>
  environments: REnvironmentInformation
  activeScope:  DataflowScopeName
}

export type DataflowProcessorFolds<OtherInfo> = Omit<StatefulFoldFunctions<OtherInfo, DataflowProcessorDown<OtherInfo>, DataflowInformation<OtherInfo>>, 'down'>

export function dataflowFold<OtherInfo>(ast: RNodeWithParent<OtherInfo>,
                                        initial: DataflowProcessorDown<OtherInfo & ParentInformation>,
                                        folds: DataflowProcessorFolds<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo & ParentInformation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- just so we do not have to re-create
  const statefulFolds: any = folds
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  statefulFolds.down = down
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return foldAstStateful(ast, initial, statefulFolds)
}

function down<OtherInfo>(_node: RNodeWithParent<OtherInfo & ParentInformation>, down: DataflowProcessorDown<OtherInfo & ParentInformation>): DataflowProcessorDown<OtherInfo & ParentInformation> {
  // TODO: support scope change on functions, nested functions, `assign`, `eval` in env etc.
  return down
}
