import { DataflowInformation, initializeCleanDataflowInformation } from '../info'
import { DataflowProcessorInformation } from '../../processor'

export function processUninterestingLeaf<OtherInfo>(_leaf: unknown, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return initializeCleanDataflowInformation(info)
}
