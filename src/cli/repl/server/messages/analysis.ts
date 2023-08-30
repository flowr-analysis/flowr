import { FlowrBaseMessage, RequestMessageDefinition } from './messages'
import { LAST_PER_FILE_STEP, StepResults } from '../../../../core'
import Joi from 'joi'
import { FlowRServerConnection } from '../connection'

export interface FileAnalysisRequestMessage extends FlowrBaseMessage {
	type:      'request-file-analysis',
	filetoken: string,
	filename:  string,
	content:   string
}


export const requestAnalysisMessage: RequestMessageDefinition<FileAnalysisRequestMessage, [FlowRServerConnection]> = {
	type:   'request-file-analysis',
	schema: Joi.object({
		type:      Joi.string().valid('request-file-analysis').required(),
		filetoken: Joi.string().required(),
		filename:  Joi.string().required(),
		content:   Joi.string().required()
	}),

	handle(message: FileAnalysisRequestMessage, information: [FlowRServerConnection]) {
		console.log('received file analysis request')
	}
}


export interface FileAnalysisResponseMessage extends FlowrBaseMessage {
	type:    'response-file-analysis',
	results: StepResults<typeof LAST_PER_FILE_STEP>
}

