import { FlowrBaseMessage, RequestMessageDefinition } from './messages'
import Joi from 'joi'

export interface ExecuteReplExpressionRequestMessage extends FlowrBaseMessage {
	type:       'request-repl-execution',
	/** Should ansi formatting be enabled for the response? Is `false` by default.  */
	ansi?:      boolean,
	/** The expression to execute */
	expression: string
}

// TODO: document that all use same shell
export const executeReplExpressionMessage: RequestMessageDefinition<ExecuteReplExpressionRequestMessage> = {
	type:   'request-repl-execution',
	schema: Joi.object({
		type:       Joi.string().valid('request-repl-execution').required(),
		id:         Joi.string().optional(),
		ansi:       Joi.boolean().optional(),
		expression: Joi.string().required(),
	})
}


// TODO: document intermediate, ended by end message
export interface ExecuteReplExpressionIntermediateMessage extends FlowrBaseMessage {
	type:   'response-repl-execution'
	stream: 'stdout' | 'stderr'
	result: string
}

// TODO: note that tcp should ensure the ordering
export interface ExecuteReplExpressionEndMessage extends FlowrBaseMessage {
	type: 'end-repl-execution'
}

