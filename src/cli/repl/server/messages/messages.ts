/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import Joi from 'joi'
import { SliceRequestMessage } from './slice'

export interface FlowrBaseMessage {
	type: string
	/**
	 * The id that links a request with its responses, it is up to the calling client to make sure it is unique.
	 * However, the client does not have to pass the id if it does not need to link the request with its response.
	 * The id is always undefined if the message is unprompted (e.g., with hello) or the id unknown.
	 */
	id:   string | undefined
}

export const baseMessage: RequestMessageDefinition<FlowrBaseMessage> = {
	type:   '**base**',
	schema: Joi.object({
		type: Joi.string().required(),
		id:   Joi.string().optional()
	}).unknown(true)
}

export interface RequestMessageDefinition<T extends FlowrBaseMessage> {
	type:   T['type']
	schema: Joi.Schema
}


