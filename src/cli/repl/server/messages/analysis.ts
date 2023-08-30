import { FlowrBaseMessage, RequestMessageDefinition } from './messages'
import { LAST_PER_FILE_STEP, StepResults } from '../../../../core'
import Joi from 'joi'

export interface FileAnalysisRequestMessage extends FlowrBaseMessage {
	type:      'request-file-analysis',
	filetoken: string,
	filename:  string,
	/** the contents of the file, give either this or the `filepath`. */
	content?:  string
	/** the filepath on the local machine, accessible to flowR, or simply. Give either this or the `content` */
	filepath?: string
}


export const requestAnalysisMessage: RequestMessageDefinition<FileAnalysisRequestMessage> = {
	type:   'request-file-analysis',
	schema: Joi.object({
		type:      Joi.string().valid('request-file-analysis').required(),
		id:        Joi.string().optional(),
		filetoken: Joi.string().required(),
		filename:  Joi.string().required(),
		content:   Joi.string().optional(),
		filepath:  Joi.string().optional()
	}).xor('content', 'filepath')
}


export interface FileAnalysisResponseMessage extends FlowrBaseMessage {
	type:    'response-file-analysis',
	results: StepResults<typeof LAST_PER_FILE_STEP>
}

