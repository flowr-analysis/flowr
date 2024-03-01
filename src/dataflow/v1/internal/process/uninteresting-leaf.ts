import { initializeCleanDataflowInformation, type DataflowInformation } from '../../../common/info'
import type { DataflowProcessorInformation } from '../../processor'

export function processUninterestingLeaf<OtherInfo>(_leaf: unknown, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return initializeCleanDataflowInformation(info)
}
