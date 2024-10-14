import type { CallContextQuery } from './catalog/call-context-query/call-context-query-format';
import { CallTargets } from './catalog/call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { BaseQueryFormat, BaseQueryResult } from './base-query-format';
import { executeCallContextQueries } from './catalog/call-context-query/call-context-query-executor';
import { guard } from '../util/assert';
import type { VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
import { SupportedVirtualQueries } from './virtual-query/virtual-queries';
import type { Writable } from 'ts-essentials';
import type { VirtualCompoundConstraint } from './virtual-query/compound-query';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeDataflowQuery } from './catalog/dataflow-query/dataflow-query-executor';
import type { DataflowQuery } from './catalog/dataflow-query/dataflow-query-format';
import { executeIdMapQuery } from './catalog/id-map-query/id-map-query-executor';
import type { IdMapQuery } from './catalog/id-map-query/id-map-query-format';
import { executeNormalizedAstQuery } from './catalog/normalized-ast-query/normalized-ast-query-executor';
import type {	NormalizedAstQuery } from './catalog/normalized-ast-query/normalized-ast-query-format';
import { bold, type OutputFormatter } from '../util/ansi';
import { printAsMs } from '../util/time';
import { asciiCallContext, summarizeIdsIfTooLong } from '../cli/repl/commands/repl-query';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import { graphToMermaidUrl } from '../util/mermaid/dfg';
import { normalizedAstToMermaidUrl } from '../util/mermaid/ast';
import Joi from 'joi';
import { executeDependenciesQuery } from './catalog/dependencies-query/dependencies-query-executor';
import type { DependenciesQuery } from './catalog/dependencies-query/dependencies-query-format';
import { printResultSection } from './catalog/dependencies-query/dependencies-query-format';

export type Query = CallContextQuery | DataflowQuery | NormalizedAstQuery | IdMapQuery | DependenciesQuery;

export type QueryArgumentsWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

export interface BasicQueryData {
	readonly ast:   NormalizedAst;
	readonly graph: DataflowGraph;
}

/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type QueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryResult> = (data: BasicQueryData, query: readonly Query[]) => Result;

type SupportedQueries = {
	[QueryType in Query['type']]: SupportedQuery<QueryType>
}

interface SupportedQuery<QueryType extends BaseQueryFormat['type']> {
	executor:        QueryExecutor<QueryArgumentsWithType<QueryType>, BaseQueryResult>
	asciiSummarizer: (formatter: OutputFormatter, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>, queryResults: BaseQueryResult, resultStrings: string[]) => boolean
	schema:          Joi.ObjectSchema
}

export const SupportedQueries = {
	'call-context': {
		executor:        executeCallContextQueries,
		asciiSummarizer: (formatter, processed, queryResults, result) => {
			const out = queryResults as QueryResults<'call-context'>['call-context'];
			result.push(`Query: ${bold('call-context', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(asciiCallContext(formatter, out, processed));
			return true;
		},
		schema: Joi.object({
			type:           Joi.string().valid('call-context').required().description('The type of the query.'),
			callName:       Joi.string().required().description('Regex regarding the function name!'),
			callNameExact:  Joi.boolean().optional().description('Should we automatically add the `^` and `$` anchors to the regex to make it an exact match?'),
			kind:           Joi.string().optional().description('The kind of the call, this can be used to group calls together (e.g., linking `plot` to `visualize`). Defaults to `.`'),
			subkind:        Joi.string().optional().description('The subkind of the call, this can be used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.`'),
			callTargets:    Joi.string().valid(...Object.values(CallTargets)).optional().description('Call targets the function may have. This defaults to `any`. Request this specifically to gain all call targets we can resolve.'),
			includeAliases: Joi.boolean().optional().description('Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?'),
			linkTo:         Joi.object({
				type:     Joi.string().valid('link-to-last-call').required().description('The type of the linkTo sub-query.'),
				callName: Joi.string().required().description('Regex regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression.')
			}).optional().description('Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc.')
		}).description('Call context query used to find calls in the dataflow graph')
	},
	'dataflow': {
		executor:        executeDataflowQuery,
		asciiSummarizer: (formatter, _processed, queryResults, result) => {
			const out = queryResults as QueryResults<'dataflow'>['dataflow'];
			result.push(`Query: ${bold('dataflow', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Dataflow Graph](${graphToMermaidUrl(out.graph)})`);
			return true;
		},
		schema: Joi.object({
			type: Joi.string().valid('dataflow').required().description('The type of the query.'),
		}).description('The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!')
	},
	'id-map': {
		executor:        executeIdMapQuery,
		asciiSummarizer: (formatter, _processed, queryResults, result) => {
			const out = queryResults as QueryResults<'id-map'>['id-map'];
			result.push(`Query: ${bold('id-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ Id List: {${summarizeIdsIfTooLong([...out.idMap.keys()])}}`);
			return true;
		},
		schema: Joi.object({
			type: Joi.string().valid('id-map').required().description('The type of the query.'),
		}).description('The id map query retrieves the id map from the normalized AST.')
	},
	'normalized-ast': {
		executor:        executeNormalizedAstQuery,
		asciiSummarizer: (formatter, _processed, queryResults, result) => {
			const out = queryResults as QueryResults<'normalized-ast'>['normalized-ast'];
			result.push(`Query: ${bold('normalized-ast', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Normalized AST](${normalizedAstToMermaidUrl(out.normalized.ast)})`);
			return true;
		},
		schema: Joi.object({
			type: Joi.string().valid('normalized-ast').required().description('The type of the query.'),
		}).description('The normalized AST query simply returns the normalized AST, there is no need to pass it multiple times!')
	},
	'dependencies': {
		executor:        executeDependenciesQuery,
		asciiSummarizer: (formatter, _processed, queryResults, result) => {
			const out = queryResults as QueryResults<'dependencies'>['dependencies'];
			result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			printResultSection('Libraries', out.libraries, result, l => `Library Name: ${l.libraryName}`);
			printResultSection('Sourced Files', out.sourcedFiles, result, s => `Sourced File: ${s.file}`);
			printResultSection('Read Data', out.readData, result, r => `Source: ${r.source}`);
			printResultSection('Written Data', out.writtenData, result, w => `Destination: ${w.destination}`);
			return true;
		},
		schema: Joi.object({
			type: Joi.string().valid('dependencies').required().description('The type of the query.'),
		}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.')
	}
} as const satisfies SupportedQueries;

export type SupportedQueryTypes = keyof typeof SupportedQueries;
export type QueryResult<Type extends Query['type']> = ReturnType<typeof SupportedQueries[Type]['executor']>;

export function executeQueriesOfSameType<SpecificQuery extends Query>(data: BasicQueryData, ...queries: readonly SpecificQuery[]): QueryResult<SpecificQuery['type']> {
	guard(queries.length > 0, 'At least one query must be provided');
	/* every query must have the same type */
	guard(queries.every(q => q.type === queries[0].type), 'All queries must have the same type');
	const query = SupportedQueries[queries[0].type];
	guard(query !== undefined, `Unsupported query type: ${queries[0].type}`);
	return query.executor(data, queries as never) as QueryResult<SpecificQuery['type']>;
}

function isVirtualQuery<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(query: QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>): query is VirtualQueryArgumentsWithType<Base, VirtualArguments> {
	return SupportedVirtualQueries[query.type as keyof typeof SupportedVirtualQueries] !== undefined;
}

function groupQueriesByType<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(queries: readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[]): Record<Query['type'], Query[]> {
	const grouped: Record<Query['type'], Query[]> = {} as Record<Query['type'], Query[]>;
	function addQuery(query: Query) {
		if(grouped[query.type] === undefined) {
			grouped[query.type] = [];
		}
		grouped[query.type].push(query);
	}
	for(const query of queries) {
		if(isVirtualQuery(query)) {
			const executor = SupportedVirtualQueries[query.type];
			const subQueries = executor(query);
			for(const subQuery of subQueries) {
				addQuery(subQuery);
			}
		} else {
			addQuery(query);
		}
	}
	return grouped;
}

/* a record mapping the query type present to its respective result */
export type QueryResults<Base extends SupportedQueryTypes> = {
	readonly [QueryType in Base]: QueryResult<QueryType>
} & BaseQueryResult


type OmitFromValues<T, K extends string | number | symbol> = {
	[P in keyof T]?: Omit<T[P], K>
}

export type QueryResultsWithoutMeta<Queries extends Query> = OmitFromValues<Omit<QueryResults<Queries['type']>, '.meta'>, '.meta'>;

export type Queries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
> = readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[];

export function executeQueries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(data: BasicQueryData, queries: Queries<Base, VirtualArguments>): QueryResults<Base> {
	const now = Date.now();
	const grouped = groupQueriesByType(queries);
	const results = {} as Writable<QueryResults<Base>>;
	for(const type of Object.keys(grouped) as Base[]) {
		results[type] = executeQueriesOfSameType(data, ...grouped[type]) as QueryResults<Base>[Base];
	}
	results['.meta'] = {
		timing: Date.now() - now
	};
	return results as QueryResults<Base>;
}
