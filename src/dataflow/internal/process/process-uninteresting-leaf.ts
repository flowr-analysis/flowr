import { initializeCleanDataflowInformation, type DataflowInformation } from '../../info';
import type { DataflowProcessorInformation } from '../../processor';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';


/**
 * Processes a leaf node that does not contribute to dataflow by initializing
 * a clean dataflow information object for it.
 * This can be used to ignore nodes that do not affect dataflow analysis.
 */
export function processUninterestingLeaf<OtherInfo>(leaf: RNodeWithParent, info: DataflowProcessorInformation<OtherInfo>): DataflowInformation {
	return initializeCleanDataflowInformation(leaf.info.id, info);
}
