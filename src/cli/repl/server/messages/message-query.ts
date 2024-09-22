import type { IdMessageBase, MessageDefinition } from './messages';
import type { NodeId } from '../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import Joi from 'joi';
import { QueriesSchema } from '../../../../queries/query-schema';
import type { Query } from '../../../../queries/query';

export interface QueryRequestMessage extends IdMessageBase {
	type:      'request-query',
	/** The {@link FileAnalysisRequestMessage#filetoken} of the file/data */
	filetoken: string,
	/** The query to run on the file analysis information */
	query:     Query
}

export const requestQueryMessage: MessageDefinition<QueryRequestMessage> = {
	type:   'request-query',
	schema: Joi.object({
		type:      Joi.string().valid('request-query').required(),
		id:        Joi.string().optional().description('If you give the id, the response will be sent to the client with the same id.'),
		filetoken: Joi.string().required().description('The filetoken of the file/data retrieved from the analysis request.'),
		query:     QueriesSchema.required().description('The query to run on the file analysis information.')
	})
};

export interface LineageResponseMessage extends IdMessageBase {
	type:    'response-lineage',
	/** The lineage of the given criterion. With this being the representation of a set, there is no guarantee about order. */
	lineage: NodeId[]
}
