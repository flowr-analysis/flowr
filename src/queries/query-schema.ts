import Joi from 'joi';
import { CallTargets } from './catalog/call-context-query/call-context-query-format';

export const CallContextQuerySchema = Joi.object({
	type:           Joi.string().valid('call-context').required().description('The type of the query.'),
	callName:       Joi.string().required().description('Regex regarding the function name!'),
	kind:           Joi.string().optional().description('The kind of the call, this can be used to group calls together (e.g., linking `plot` to `visualize`). Defaults to `.`'),
	subkind:        Joi.string().optional().description('The subkind of the call, this can be used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.`'),
	callTargets:    Joi.string().valid(...Object.values(CallTargets)).optional().description('Call targets the function may have. This defaults to `any`. Request this specifically to gain all call targets we can resolve.'),
	includeAliases: Joi.boolean().optional().description('Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?'),
	linkTo:         Joi.object({
		type:     Joi.string().valid('link-to-last-call').required().description('The type of the linkTo sub-query.'),
		callName: Joi.string().required().description('Regex regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression.')
	}).optional().description('Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc.')
}).description('Call context query used to find calls in the dataflow graph');

export const DataflowQuerySchema = Joi.object({
	type: Joi.string().valid('dataflow').required().description('The type of the query.'),
}).description('The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!');

export const IdMapQuerySchema = Joi.object({
	type: Joi.string().valid('id-map').required().description('The type of the query.'),
}).description('The Id map query retrieves the id map from the dataflow graph');

export const SupportedQueriesSchema = Joi.alternatives(
	CallContextQuerySchema,
	DataflowQuerySchema,
	IdMapQuerySchema
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
