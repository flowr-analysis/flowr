import type { CallContextQuery } from './catalog/call-context-query/call-context-query-format';
import { CallContextQueryDefinition } from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from './base-query-format';
import { guard } from '../util/assert';
import type { VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
import { SupportedVirtualQueries } from './virtual-query/virtual-queries';
import type { Writable } from 'ts-essentials';
import type { VirtualCompoundConstraint } from './virtual-query/compound-query';
import type { DataflowQuery } from './catalog/dataflow-query/dataflow-query-format';
import { DataflowQueryDefinition } from './catalog/dataflow-query/dataflow-query-format';
import type { IdMapQuery } from './catalog/id-map-query/id-map-query-format';
import { IdMapQueryDefinition } from './catalog/id-map-query/id-map-query-format';
import type { NormalizedAstQuery } from './catalog/normalized-ast-query/normalized-ast-query-format';
import { NormalizedAstQueryDefinition } from './catalog/normalized-ast-query/normalized-ast-query-format';
import type { LineageQuery } from './catalog/lineage-query/lineage-query-format';
import { LineageQueryDefinition } from './catalog/lineage-query/lineage-query-format';
import type { StaticSliceQuery } from './catalog/static-slice-query/static-slice-query-format';
import { StaticSliceQueryDefinition } from './catalog/static-slice-query/static-slice-query-format';
import type { DataflowClusterQuery } from './catalog/cluster-query/cluster-query-format';
import { ClusterQueryDefinition } from './catalog/cluster-query/cluster-query-format';
import type { DependenciesQuery } from './catalog/dependencies-query/dependencies-query-format';
import { DependenciesQueryDefinition } from './catalog/dependencies-query/dependencies-query-format';
import type { OutputFormatter } from '../util/text/ansi';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import Joi from 'joi';
import type { LocationMapQuery } from './catalog/location-map-query/location-map-query-format';
import { LocationMapQueryDefinition } from './catalog/location-map-query/location-map-query-format';
import type { ConfigQuery } from './catalog/config-query/config-query-format';
import { ConfigQueryDefinition } from './catalog/config-query/config-query-format';
import type { SearchQuery } from './catalog/search-query/search-query-format';
import { SearchQueryDefinition } from './catalog/search-query/search-query-format';
import type {
	HappensBeforeQuery } from './catalog/happens-before-query/happens-before-query-format';
import {
	HappensBeforeQueryDefinition
} from './catalog/happens-before-query/happens-before-query-format';
import type { ResolveValueQuery } from './catalog/resolve-value-query/resolve-value-query-format';
import { ResolveValueQueryDefinition } from './catalog/resolve-value-query/resolve-value-query-format';
import type { DataflowLensQuery } from './catalog/dataflow-lens-query/dataflow-lens-query-format';
import { DataflowLensQueryDefinition } from './catalog/dataflow-lens-query/dataflow-lens-query-format';
import type { ProjectQuery } from './catalog/project-query/project-query-format';
import { ProjectQueryDefinition } from './catalog/project-query/project-query-format';
import type { OriginQuery } from './catalog/origin-query/origin-query-format';
import { OriginQueryDefinition } from './catalog/origin-query/origin-query-format';

export type Query = CallContextQuery
	| ConfigQuery
	| SearchQuery
	| DataflowQuery
	| DataflowLensQuery
	| NormalizedAstQuery
	| IdMapQuery
	| DataflowClusterQuery
	| StaticSliceQuery
	| LineageQuery
	| DependenciesQuery
	| LocationMapQuery
	| HappensBeforeQuery
	| ResolveValueQuery
	| ProjectQuery
	| OriginQuery
	;

export type QueryArgumentsWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type QueryExecutor<Query extends BaseQueryFormat, Result extends BaseQueryResult> = (data: BasicQueryData, query: readonly Query[]) => Result;

type SupportedQueries = {
	[QueryType in Query['type']]: SupportedQuery<QueryType>
}

export interface SupportedQuery<QueryType extends BaseQueryFormat['type']> {
	executor:        QueryExecutor<QueryArgumentsWithType<QueryType>, BaseQueryResult>
	asciiSummarizer: (formatter: OutputFormatter, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>, queryResults: BaseQueryResult, resultStrings: string[]) => boolean
	schema:          Joi.ObjectSchema
}

export const SupportedQueries = {
	'call-context':     CallContextQueryDefinition,
	'config':           ConfigQueryDefinition,
	'dataflow':         DataflowQueryDefinition,
	'dataflow-lens':    DataflowLensQueryDefinition,
	'id-map':           IdMapQueryDefinition,
	'normalized-ast':   NormalizedAstQueryDefinition,
	'dataflow-cluster': ClusterQueryDefinition,
	'static-slice':     StaticSliceQueryDefinition,
	'lineage':          LineageQueryDefinition,
	'dependencies':     DependenciesQueryDefinition,
	'location-map':     LocationMapQueryDefinition,
	'search':           SearchQueryDefinition,
	'happens-before':   HappensBeforeQueryDefinition,
	'resolve-value':    ResolveValueQueryDefinition,
	'project':          ProjectQueryDefinition,
	'origin':           OriginQueryDefinition,
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

export function SupportedQueriesSchema() {
	return Joi.alternatives(
		Object.values(SupportedQueries).map(q => q.schema)
	).description('Supported queries');
}

export const CompoundQuerySchema = Joi.object({
	type:            Joi.string().valid('compound').required().description('The type of the query.'),
	query:           Joi.string().required().description('The query to run on the file analysis information.'),
	commonArguments: Joi.object().required().description('Common arguments for all queries.'),
	arguments:       Joi.array().items(Joi.object()).required().description('Arguments for each query.')
}).description('Compound query used to combine queries of the same type');
export function VirtualQuerySchema() {
	return Joi.alternatives(
		CompoundQuerySchema
	).description('Virtual queries (used for structure)');
}
export function AnyQuerySchema() {
	return Joi.alternatives(
		SupportedQueriesSchema(),
		VirtualQuerySchema()
	).description('Any query');
}
export function QueriesSchema() {
	return Joi.array().items(AnyQuerySchema()).description('Queries to run on the file analysis information (in the form of an array)');
}
