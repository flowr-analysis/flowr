import Joi from 'joi'
import net from 'node:net'
import { sendMessage } from './send'
import { baseSchema, FlowrBaseMessage, RequestMessageDefinition } from './messages/messages'
import { FlowrErrorMessage } from './messages/error'

export interface ValidationErrorResult { type: 'error', reason: Joi.ValidationError }
export interface SuccessValidationResult<T extends FlowrBaseMessage> { type: 'success', message: T }
export type ValidationResult<T extends FlowrBaseMessage> = SuccessValidationResult<T> | ValidationErrorResult

export function validateBaseMessageFormat(input: string): ValidationResult<FlowrBaseMessage> {
	const result = baseSchema.validate(JSON.parse(input))
	return result.error ? { type: 'error', reason: result.error } : { type: 'success', message: result.value as FlowrBaseMessage }
}

export function validateMessage<T extends FlowrBaseMessage>(input: FlowrBaseMessage, def: RequestMessageDefinition<T>): ValidationResult<T>  {
	const result = def.schema.validate(input)
	return result.error ? { type: 'error', reason: result.error } : { type: 'success', message: input as T }
}

export function answerForValidationError(client: net.Socket, result: ValidationErrorResult): void {
	sendMessage<FlowrErrorMessage>(client, {
		type:   'error',
		fatal:  false,
		// TODO: add more information?
		reason: `Invalid message format: ${result.reason.message}`
	})
}
