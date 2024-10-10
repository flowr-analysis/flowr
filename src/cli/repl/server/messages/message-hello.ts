import type { VersionInformation } from '../../commands/repl-version';
import type { IdMessageBase, MessageDefinition } from './all-messages';
import Joi from 'joi';

/**
 * The hello message is automatically sent by the sever upon connection.
 */
export interface FlowrHelloResponseMessage extends IdMessageBase {
	type:       'hello',
	/** The hello message never has an id, it is always undefined */
	id:         undefined,
	/**
	 * A unique name that is assigned to each client.
	 * It has no semantic meaning and is only used/useful for debugging.
	 */
	clientName: string,
	/**
	 * Describes which versions are in use on the server.
	 * @see VersionInformation
	 */
	versions:   VersionInformation
}

export const helloMessageDefinition: MessageDefinition<FlowrHelloResponseMessage> = {
	type:   'hello',
	schema: Joi.object({
		type:       Joi.string().required().valid('hello').description('The type of the hello message.'),
		id:         Joi.any().forbidden().description('The id of the message is always undefined (as it is the initial message and not requested).'),
		clientName: Joi.string().required().description('A unique name that is assigned to each client. It has no semantic meaning and is only used/useful for debugging.'),
		versions:   Joi.object({
			flowr: Joi.string().required().description('The version of the flowr server running in semver format.'),
			r:     Joi.string().required().description('The version of the underlying R shell running in semver format.')
		}).required()
	}).required()
};
