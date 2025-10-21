import type { CallContextQuery } from './catalog/call-context-query/call-context-query-format';
import { CallContextQueryDefinition } from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from './base-query-format';
import { guard } from '../util/assert';
import type { VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
import { SupportedVirtualQueries } from './virtual-query/virtual-queries';
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
import Joi from 'joi';
import type { LocationMapQuery } from './catalog/location-map-query/location-map-query-format';
import { LocationMapQueryDefinition } from './catalog/location-map-query/location-map-query-format';
import type { ConfigQuery } from './catalog/config-query/config-query-format';
import { ConfigQueryDefinition } from './catalog/config-query/config-query-format';
import type { SearchQuery } from './catalog/search-query/search-query-format';
import { SearchQueryDefinition } from './catalog/search-query/search-query-format';
import type { HappensBeforeQuery } from './catalog/happens-before-query/happens-before-query-format';
import { HappensBeforeQueryDefinition } from './catalog/happens-before-query/happens-before-query-format';
import type { ResolveValueQuery } from './catalog/resolve-value-query/resolve-value-query-format';
import { ResolveValueQueryDefinition } from './catalog/resolve-value-query/resolve-value-query-format';
import type { DataflowLensQuery } from './catalog/dataflow-lens-query/dataflow-lens-query-format';
import { DataflowLensQueryDefinition } from './catalog/dataflow-lens-query/dataflow-lens-query-format';
import type { ProjectQuery } from './catalog/project-query/project-query-format';
import { ProjectQueryDefinition } from './catalog/project-query/project-query-format';
import type { OriginQuery } from './catalog/origin-query/origin-query-format';
import { OriginQueryDefinition } from './catalog/origin-query/origin-query-format';
import type { LinterQuery } from './catalog/linter-query/linter-query-format';
import { LinterQueryDefinition } from './catalog/linter-query/linter-query-format';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowQuery } from './catalog/control-flow-query/control-flow-query-format';
import { ControlFlowQueryDefinition } from './catalog/control-flow-query/control-flow-query-format';
import type { DfShapeQuery } from './catalog/df-shape-query/df-shape-query-format';
import { DfShapeQueryDefinition } from './catalog/df-shape-query/df-shape-query-format';
import type { AsyncOrSync, Writable } from 'ts-essentials';
import type { FlowrConfigOptions } from '../config';
import type {
	InspectHigherOrderQuery } from './catalog/inspect-higher-order-query/inspect-higher-order-query-format';
import {
	InspectHigherOrderQueryDefinition
} from './catalog/inspect-higher-order-query/inspect-higher-order-query-format';
import type { FlowrAnalysisProvider } from '../project/flowr-analyzer';
import { log } from '../util/log';

/**
 * These are all queries that can be executed from within flowR
 * {@link SynchronousQuery} are queries that can be executed synchronously, i.e., they do not return a Promise.
 */
export type Query = CallContextQuery
	| ConfigQuery
	| SearchQuery
	| DataflowQuery
	| ControlFlowQuery
	| DataflowLensQuery
	| DfShapeQuery
	| NormalizedAstQuery
	| IdMapQuery
	| DataflowClusterQuery
	| StaticSliceQuery
	| LineageQuery
	| DependenciesQuery
	| LocationMapQuery
	| HappensBeforeQuery
    | InspectHigherOrderQuery
	| ResolveValueQuery
	| ProjectQuery
	| OriginQuery
	| LinterQuery
	;

export type QueryArgumentsWithType<QueryType extends BaseQueryFormat['type']> = Query & { type: QueryType };

/* Each executor receives all queries of its type in case it wants to avoid repeated traversal */
export type QueryExecutor<Query extends BaseQueryFormat, Result extends Promise<BaseQueryResult>> = (data: BasicQueryData, query: readonly Query[]) => Result;

type SupportedQueriesType = {
	[QueryType in Query['type']]: SupportedQuery<QueryType>
}

export interface SupportedQuery<QueryType extends BaseQueryFormat['type'] = BaseQueryFormat['type']> {
	executor:             QueryExecutor<QueryArgumentsWithType<QueryType>, Promise<BaseQueryResult>>
    /** optional completion in, e.g., the repl */
	completer?:           (splitLine: readonly string[], config: FlowrConfigOptions) => string[]
    /** optional query construction from an, e.g., repl line */
	fromLine?:            (splitLine: readonly string[], config: FlowrConfigOptions) => Query | Query[] | undefined
	asciiSummarizer:      (formatter: OutputFormatter, analyzer: FlowrAnalysisProvider, queryResults: BaseQueryResult, resultStrings: string[], query: readonly Query[]) => AsyncOrSync<boolean>
	schema:               Joi.ObjectSchema
	/**
	 * Flattens the involved query nodes to be added to a flowR search when the {@link fromQuery} function is used based on the given result after this query is executed.
	 * If this query does not involve any nodes, an empty array can be returned.
	 */
	flattenInvolvedNodes: (queryResults: BaseQueryResult, query: readonly Query[]) => NodeId[]
}

export const SupportedQueries = {
	'call-context':         CallContextQueryDefinition,
	'config':               ConfigQueryDefinition,
	'control-flow':         ControlFlowQueryDefinition,
	'dataflow':             DataflowQueryDefinition,
	'dataflow-lens':        DataflowLensQueryDefinition,
	'df-shape':             DfShapeQueryDefinition,
	'id-map':               IdMapQueryDefinition,
	'normalized-ast':       NormalizedAstQueryDefinition,
	'dataflow-cluster':     ClusterQueryDefinition,
	'static-slice':         StaticSliceQueryDefinition,
	'lineage':              LineageQueryDefinition,
	'dependencies':         DependenciesQueryDefinition,
	'location-map':         LocationMapQueryDefinition,
	'search':               SearchQueryDefinition,
	'happens-before':       HappensBeforeQueryDefinition,
	'inspect-higher-order': InspectHigherOrderQueryDefinition,
	'resolve-value':        ResolveValueQueryDefinition,
	'project':              ProjectQueryDefinition,
	'origin':               OriginQueryDefinition,
	'linter':               LinterQueryDefinition
} as const satisfies SupportedQueriesType;

export type SupportedQueryTypes = keyof typeof SupportedQueries;
export type QueryResult<Type extends Query['type']> = Promise<ReturnType<typeof SupportedQueries[Type]['executor']>>;

export async function executeQueriesOfSameType<SpecificQuery extends Query>(data: BasicQueryData, queries: readonly SpecificQuery[]): QueryResult<SpecificQuery['type']> {
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
		grouped[query.type] ??= [];
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
export type QueryResults<Base extends SupportedQueryTypes = SupportedQueryTypes> = {
	readonly [QueryType in Base]: Awaited<QueryResult<QueryType>>
} & BaseQueryResult


type OmitFromValues<T, K extends string | number | symbol> = {
	[P in keyof T]?: Omit<T[P], K>
}

export type QueryResultsWithoutMeta<Queries extends Query> = OmitFromValues<Omit<QueryResults<Queries['type']>, '.meta'>, '.meta'>;

export type Queries<
	Base extends SupportedQueryTypes = SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
> = readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[];

/**
 * This is the main query execution function that takes a set of queries and executes them on the given data.
 */
export async function executeQueries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(data: BasicQueryData, queries: Queries<Base, VirtualArguments>): Promise<QueryResults<Base>> {
	const now = Date.now();
	const grouped = groupQueriesByType(queries);
	const entries = Object.entries(grouped) as [Base, typeof grouped[Base]][];

	const results: [Base, Awaited<QueryResult<Base>> | undefined][] = [];

	for(const [type, group] of entries) {
		try {
			const result = await Promise.resolve(executeQueriesOfSameType(data, group));
			results.push([type, result] as [Base, Awaited<QueryResult<Base>>]);
		} catch(e) {
			log.error(e);
			results.push([type, undefined]);
		}
	}

	const r = Object.fromEntries(results) as Writable<QueryResults<Base>>;
	r['.meta'] = {
		timing: Date.now() - now
	};
	return r as QueryResults<Base>;
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
