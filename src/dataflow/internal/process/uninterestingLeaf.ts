import { DataflowInformation, initializeCleanInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'

// TODO: record value node in graph?
export function processUninterestingLeaf<OtherInfo>(_leaf: unknown, info: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  return initializeCleanInfo(info.ast, info.scope)
}
