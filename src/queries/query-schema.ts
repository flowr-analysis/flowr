import Joi from 'joi';
import { SupportedQueries } from './query';

export const SupportedQueriesSchema = Joi.alternatives(
	Object.values(SupportedQueries).map(q => q.schema)
).description('Supported queries');

export const CompoundQuerySchema = Joi.object({
	type:            Joi.string().valid('compound').required().description('The type of the query.'),
	query:           Joi.string().required().description('The query to run on the file analysis information.'),
	commonArguments: Joi.object().required().description('Common arguments for all queries.'),
	arguments:       Joi.array().items(Joi.object()).required().description('Arguments for each query.')
}).description('Compound query used to combine queries of the same type');

export const VirtualQuerySchema = Joi.alternatives(
	CompoundQuerySchema
).description('Virtual queries (used for structure)');

export const AnyQuerySchema = Joi.alternatives(
	SupportedQueriesSchema,
	VirtualQuerySchema
).description('Any query');

export const QueriesSchema = Joi.array().items(AnyQuerySchema).description('Queries to run on the file analysis information (in the form of an array)');
