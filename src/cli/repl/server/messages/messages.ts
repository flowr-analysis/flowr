/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import Joi from 'joi'

export interface FlowrBaseMessage {
	type: string
}

export const baseSchema = Joi.object({ type: Joi.string().required() }).unknown(true)

export interface RequestMessageDefinition<T extends FlowrBaseMessage> {
	type:   T['type']
	schema: Joi.Schema
}


