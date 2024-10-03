/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import * as Joi from 'joi';
import type { FlowrHelloResponseMessage } from './message-hello';
import type { FileAnalysisRequestMessage, FileAnalysisResponseMessageJson } from './message-analysis';
import type { ExecuteEndMessage, ExecuteIntermediateResponseMessage, ExecuteRequestMessage } from './message-repl';
import type { SliceRequestMessage, SliceResponseMessage } from './message-slice';
import type { FlowrErrorMessage } from './message-error';
import type { LineageRequestMessage, LineageResponseMessage } from './message-lineage';
import type { QueryRequestMessage, QueryResponseMessage } from './message-query';

/**
 * If you send a message it must *not* contain a newline but the message must be terminated by a newline.
 */
export interface IdMessageBase {
	/**
	 * The at this time unknown type
	 */
	type: string
	/**
	 * The id that links a request with its responses, it is up to the calling client to make sure it is unique.
	 * However, the client does not have to pass the id if it does not need to link the request with its response.
	 * The id is always undefined if the message is unprompted (e.g., with hello) or the id unknown.
	 */
	id:   string | undefined
}

export interface MessageDefinition<T extends FlowrMessage | IdMessageBase> {
	type:   T['type'] | undefined
	schema: Joi.Schema
}


export const baseMessage: MessageDefinition<IdMessageBase> = {
	type:   '**base**',
	schema: Joi.object({
		type: Joi.string().required(),
		id:   Joi.string().optional()
	}).unknown(true)
};

/**
 * This is the main message type that should be used to represent a message in *flowR*
 */
export type FlowrMessage = FlowrHelloResponseMessage
                         | FileAnalysisRequestMessage
                         | FileAnalysisResponseMessageJson
                         | ExecuteRequestMessage
                         | ExecuteIntermediateResponseMessage
                         | ExecuteEndMessage
                         | SliceRequestMessage
                         | SliceResponseMessage
                         | LineageRequestMessage
                         | LineageResponseMessage
                         | QueryRequestMessage
                         | QueryResponseMessage
                         | FlowrErrorMessage
