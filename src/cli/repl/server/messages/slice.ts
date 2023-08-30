import { SlicingCriteria } from '../../../../slicing'
import { LAST_PER_FILE_STEP, LAST_STEP, StepResults } from '../../../../core'
import { FlowrBaseMessage } from './messages'

export interface SliceRequestMessage extends FlowrBaseMessage {
	type:      'request-slice',
	filetoken: string,
	criterion: SlicingCriteria
}

export interface SliceResponseMessage extends FlowrBaseMessage {
	type:    'response-slice',
	/** only contains the results of the slice steps to not repeat ourselves */
	results: Omit<StepResults<typeof LAST_STEP>, keyof StepResults<typeof LAST_PER_FILE_STEP>>
}
