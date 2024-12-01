import type { IdMessageBase, MessageDefinition } from './all-messages';
import Joi from 'joi';
import type { Queries, QueryResults, SupportedQueryTypes } from '../../../../queries/query';
import { QueriesSchema } from '../../../../queries/query';

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
		type:      Joi.string().valid('request-query').required().description('The type of the message.'),
		id:        Joi.string().optional().description('If you give the id, the response will be sent to the client with the same id.'),
		filetoken: Joi.string().required().description('The filetoken of the file/data retrieved from the analysis request.'),
		query:     QueriesSchema().required().description('The query to run on the file analysis information.')
	}).description('Request a query to be run on the file analysis information.')
};

export interface QueryResponseMessage extends IdMessageBase {
	type:    'response-query',
	/** Contains an entry for each (non-virtual) query type requested */
	results: QueryResults<SupportedQueryTypes>
}

export const responseQueryMessage: MessageDefinition<QueryResponseMessage> = {
	type:   'response-query',
	schema: Joi.object({
		type:    Joi.string().valid('response-query').required(),
		id:      Joi.string().optional().description('The id of the message, will be the same for the request.'),
		results: Joi.object().required().description('The results of the query.')
	}).description('The response to a query request.')
};
