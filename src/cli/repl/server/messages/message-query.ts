import type { IdMessageBase, MessageDefinition } from './messages';
import Joi from 'joi';
import { QueriesSchema } from '../../../../queries/query-schema';
import type { Queries,  QueryResults, SupportedQueryTypes } from '../../../../queries/query';

export interface QueryRequestMessage extends IdMessageBase {
	type:      'request-query',
	/** The {@link FileAnalysisRequestMessage#filetoken} of the file/data */
	filetoken: string,
	/** The query to run on the file analysis information */
	query:     Queries<SupportedQueryTypes>
}

export const requestQueryMessage: MessageDefinition<QueryRequestMessage> = {
	type:   'request-query',
	schema: Joi.object({
		type:      Joi.string().valid('request-query').required(),
		id:        Joi.string().optional().description('If you give the id, the response will be sent to the client with the same id.'),
		filetoken: Joi.string().required().description('The filetoken of the file/data retrieved from the analysis request.'),
		query:     QueriesSchema.required().description('The query to run on the file analysis information.')
	}).description('Request a query to be run on the file analysis information.')
};

export interface QueryResponseMessage extends IdMessageBase {
	type:    'response-query',
	/** Contains an entry for each (non-virtual) query type requested */
	results: QueryResults<SupportedQueryTypes>
}
