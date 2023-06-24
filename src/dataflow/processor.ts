/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import { foldAstStateful, StatefulFoldFunctions } from '../r-bridge/lang:4.x/ast/model/processing/statefulFold'
import { DataflowScopeName } from './graph'
import { DecoratedAst, ParentInformation, RNodeWithParent, Type } from '../r-bridge'
import { DataflowInformation } from './internal/info'
import { pushLocalEnvironment, REnvironmentInformation } from './environments'

/**
 * information passed down during folds
 */
export interface DataflowProcessorDown<OtherInfo> {
  /**
   * Initial and frozen ast-information
   */
  readonly ast:          DecoratedAst<OtherInfo>
  /**
   * Correctly contains pushed local scopes introduced by `function` scopes.
   * Will by default *not* contain any symbol-bindings introduces along the way, they have to be decorated when moving up the tree.
   */
  readonly environments: REnvironmentInformation
  /**
   * Name of the currently active scope, (hopefully) always {@link LocalScope | Local}
   */
  readonly activeScope:  DataflowScopeName
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
  if(_node.type === Type.FunctionDefinition) {
    return {
      ...down,
      environments: pushLocalEnvironment(down.environments)
    }
  }
  // TODO: support other scope changes on `assign`, `eval` in env etc.
  return down
}
