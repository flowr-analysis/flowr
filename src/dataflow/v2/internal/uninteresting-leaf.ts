import type { DataflowProcessorInformation } from './processor'
import type { DataflowInformation } from '../../common/info'
import { initializeCleanDataflowInformation } from '../../common/info'

export function processUninterestingLeaf<OtherInfo>(_leaf: unknown, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return initializeCleanDataflowInformation(info)
}
