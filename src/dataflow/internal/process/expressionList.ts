/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInfo } from '../info'
import { RExpressionList } from '../../../r-bridge'
import { DataflowProcessorDown } from '../../processor'


export function processExpressionList<OtherInfo>(exprList: RExpressionList<OtherInfo>, expressions: DataflowInfo<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {

  // TODO
  return expressions[0]
}
