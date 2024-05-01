import { initializeCleanDataflowInformation, type DataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import type { RNodeWithParent } from '../../../r-bridge'

export function processUninterestingLeaf<OtherInfo>(leaf: RNodeWithParent, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return initializeCleanDataflowInformation(leaf.info.id, info)
}
