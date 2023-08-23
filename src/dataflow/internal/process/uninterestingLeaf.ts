import { DataflowInformation, initializeCleanInfo } from '../info'
import { DataflowProcessorInformation } from '../../processor'

export function processUninterestingLeaf<OtherInfo>(_leaf: unknown, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation<OtherInfo> {
	return initializeCleanInfo(info)
}
