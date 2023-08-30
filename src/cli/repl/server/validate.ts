import Joi from 'joi'
import { sendMessage } from './send'
import { baseMessage, FlowrBaseMessage, RequestMessageDefinition } from './messages/messages'
import { FlowrErrorMessage } from './messages/error'
import { Socket } from './net'

export interface ValidationErrorResult { type: 'error', reason: Joi.ValidationError | Error }
export interface SuccessValidationResult<T extends FlowrBaseMessage> { type: 'success', message: T }
export type ValidationResult<T extends FlowrBaseMessage> = SuccessValidationResult<T> | ValidationErrorResult

export function validateBaseMessageFormat(input: string): ValidationResult<FlowrBaseMessage> {
	try {
		return validateMessage(JSON.parse(input) as FlowrBaseMessage, baseMessage)
	} catch(e) {
		return { type: 'error', reason: e as Error }
	}
}

export function validateMessage<T extends FlowrBaseMessage>(input: FlowrBaseMessage, def: RequestMessageDefinition<T>): ValidationResult<T>  {
	try {
		const result = def.schema.validate(input)
		return result.error ? { type: 'error', reason: result.error } : { type: 'success', message: input as T }
	} catch(e) {
		return { type: 'error', reason: e as Error }
	}
}

export function answerForValidationError(client: Socket, result: ValidationErrorResult, id?: string): void {
	sendMessage<FlowrErrorMessage>(client, {
		type:   'error',
		fatal:  false,
		id:     id,
		reason: `Invalid message format: ${result.reason.message}`
	})
}
