import { FlowrBaseMessage, RequestMessageDefinition } from './messages'
import Joi from 'joi'

export interface ExecuteReplExpressionRequestMessage extends FlowrBaseMessage {
	type:       'request-repl-execution',
	/** the expression to execute */
	expression: string
}


export const executeReplExpressionMessage: RequestMessageDefinition<ExecuteReplExpressionRequestMessage> = {
	type:   'request-repl-execution',
	schema: Joi.object({
		type:       Joi.string().valid('request-repl-execution').required(),
		expression: Joi.string().required(),
	})
}


export interface ExecuteReplExpressionMessage extends FlowrBaseMessage {
	type:    'response-repl-execution',
	results: string
}

