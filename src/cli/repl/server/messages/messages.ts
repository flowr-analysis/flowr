/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import net from 'node:net'
import { jsonReplacer } from '../../../../util/json'
import Joi from 'joi'
import { FlowrErrorMessage } from './error'


export function getUnnamedSocketName(c: net.Socket): string {
	return `${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`
}

export function sendMessage<T>(c: net.Socket, message: T): void {
	const msg = JSON.stringify(message, jsonReplacer)
	console.log(`[${getUnnamedSocketName(c)}] sending message: ${msg}`)
	c.write(`${msg}\n`)
}


export interface FlowrBaseMessage {
	type: string
}

const baseSchema = Joi.object({ type: Joi.string().required() })

export interface RequestMessageDefinition<T extends FlowrBaseMessage, ExtraInformation> {
	type:   T['type']
	schema: Joi.Schema
	handle(message: T, information: ExtraInformation): void
}

export interface ValidationErrorResult { type: 'error', reason: Joi.ValidationError }
export interface SuccessValidationResult<T extends FlowrBaseMessage> { type: 'success', message: T }
export type ValidationResult<T extends FlowrBaseMessage> = SuccessValidationResult<T> | ValidationErrorResult

export function validateBaseMessageFormat(input: string): ValidationResult<FlowrBaseMessage> {
	const result = baseSchema.validate(JSON.parse(input))
	return result.error ? { type: 'error', reason: result.error } : { type: 'success', message: result.value as FlowrBaseMessage }
}

export function validateMessage<T extends FlowrBaseMessage>(input: FlowrBaseMessage, def: RequestMessageDefinition<T, unknown>): ValidationResult<T>  {
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

