import type { SingleSlicingCriterion } from '../../../../slicing/criterion/parse';
import type { IdMessageBase, MessageDefinition } from './all-messages';
import type { NodeId } from '../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import Joi from 'joi';

export interface LineageRequestMessage extends IdMessageBase {
	type:      'request-lineage',
	/** The {@link FileAnalysisRequestMessage#filetoken} of the file/data */
	filetoken: string,
	/** The criterion to start the lineage from */
	criterion: SingleSlicingCriterion,
}

export const requestLineageMessage: MessageDefinition<LineageRequestMessage> = {
	type:   'request-lineage',
	schema: Joi.object({
		type:      Joi.string().valid('request-lineage').required().description('The type of the message.'),
		id:        Joi.string().optional().description('If you give the id, the response will be sent to the client with the same id.'),
		filetoken: Joi.string().required().description('The filetoken of the file/data retrieved from the analysis request.'),
		criterion: Joi.string().required().description('The criterion to start the lineage from.')
	})
};

export interface LineageResponseMessage extends IdMessageBase {
	type:    'response-lineage',
	/** The lineage of the given criterion. With this being the representation of a set, there is no guarantee about order. */
	lineage: NodeId[]
}

export const responseLineageMessage: MessageDefinition<LineageResponseMessage> = {
	type:   'response-lineage',
	schema: Joi.object({
		type:    Joi.string().valid('response-lineage').required(),
		id:      Joi.string().optional().description('The id of the message, will be the same for the request.'),
		lineage: Joi.array().items(Joi.string()).required().description('The lineage of the given criterion.')
	})
};
