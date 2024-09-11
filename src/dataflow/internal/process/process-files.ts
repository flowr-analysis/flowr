import { type DataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { processDataflowFor } from '../../processor'
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFiles } from '../../../r-bridge/lang-4.x/ast/model/model'
import { mergeInformation } from './functions/call/named-call-handling'

export function processFiles<OtherInfo>(value: RFiles<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	return value.children
		.map(file => processDataflowFor(file, data))
		.reduce(mergeInformation)
}
