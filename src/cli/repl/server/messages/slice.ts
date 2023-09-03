import { SlicingCriteria } from '../../../../slicing'
import { LAST_PER_FILE_STEP, LAST_STEP, StepResults } from '../../../../core'
import { FlowrBaseMessage, RequestMessageDefinition } from './messages'
import Joi from 'joi'

export interface SliceRequestMessage extends FlowrBaseMessage {
	type:      'request-slice',
	/** The {@link ExecuteReplExpressionRequestMessage#filetoken} of the file to slice */
	filetoken: string,
	criterion: SlicingCriteria
}

export interface SliceResponseMessage extends FlowrBaseMessage {
	type:    'response-slice',
	/** only contains the results of the slice steps to not repeat ourselves */
	results: Omit<StepResults<typeof LAST_STEP>, keyof StepResults<typeof LAST_PER_FILE_STEP>>
}

export const requestSliceMessage: RequestMessageDefinition<SliceRequestMessage> = {
	type:   'request-slice',
	schema: Joi.object({
		type:      Joi.string().valid('request-slice').required(),
		id:        Joi.string().optional(),
		filetoken: Joi.string().required(),
		criterion: Joi.array().items(Joi.string().regex(/\d+:\d+|\d+@.*|\$\d+/)).min(0).required()
	})
}
