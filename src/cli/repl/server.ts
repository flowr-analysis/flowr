/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import { RExpressionList } from '../../r-bridge'

interface RequestMessage {
	type:      'request',
	command:   string,
	arguments: string[]
}

interface ResponseMessage<T> {
	type:    'response',
	success: boolean,
	message: T
}

export interface NormalizedAstRequestMessage extends RequestMessage {
	command: 'normalized'
}

export type NormalizedAstResponseMessage = ResponseMessage<RExpressionList>
