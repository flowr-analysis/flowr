import type * as Joi from 'joi';
import { sendMessage } from './send';
import { type FlowrMessage, type IdMessageBase, type MessageDefinition , baseMessage } from './messages/all-messages';
import type { FlowrErrorMessage } from './messages/message-error';
import type { Socket } from './net';

export interface ValidationErrorResult { type: 'error', reason: Joi.ValidationError | Error }
export interface SuccessValidationResult<T extends IdMessageBase> { type: 'success', message: T }
export type ValidationResult<T extends IdMessageBase> = SuccessValidationResult<T> | ValidationErrorResult

/**
 * Check that the serialized input is a valid base message.
 */
export function validateBaseMessageFormat(input: string): ValidationResult<IdMessageBase> {
	try {
		return validateMessage(JSON.parse(input) as IdMessageBase, baseMessage);
	} catch(e) {
		return { type: 'error', reason: e as Error };
	}
}

/**
 * Validates that the given input matches the given message definition.
 */
export function validateMessage<T extends FlowrMessage | IdMessageBase>(input: IdMessageBase, def: MessageDefinition<T>): ValidationResult<T>  {
	try {
		const result = def.schema.validate(input);
		return result.error ? { type: 'error', reason: result.error } : { type: 'success', message: input as T };
	} catch(e) {
		return { type: 'error', reason: e as Error };
	}
}

/**
 * Sends an error message to the given client indicating a validation error.
 */
export function answerForValidationError(client: Socket, result: ValidationErrorResult, id?: string): void {
	sendMessage<FlowrErrorMessage>(client, {
		type:   'error',
		fatal:  false,
		id:     id,
		reason: `Invalid message format: ${result.reason.message}`
	});
}
