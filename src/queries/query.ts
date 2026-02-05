import {
	type CallContextQuery,
	CallContextQueryDefinition
} from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from './base-query-format';
import { getGuardIssueUrl, guard } from '../util/assert';
import { SupportedVirtualQueries, type VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
import type { VirtualCompoundConstraint } from './virtual-query/compound-query';
import { type DataflowQuery, DataflowQueryDefinition } from './catalog/dataflow-query/dataflow-query-format';
import { type IdMapQuery, IdMapQueryDefinition } from './catalog/id-map-query/id-map-query-format';
import {
	type NormalizedAstQuery,
	NormalizedAstQueryDefinition
} from './catalog/normalized-ast-query/normalized-ast-query-format';
import {
	type StaticSliceQuery,
	StaticSliceQueryDefinition
} from './catalog/static-slice-query/static-slice-query-format';
import { ClusterQueryDefinition, type DataflowClusterQuery } from './catalog/cluster-query/cluster-query-format';
import {
	type DependenciesQuery,
	DependenciesQueryDefinition
} from './catalog/dependencies-query/dependencies-query-format';
import type { OutputFormatter } from '../util/text/ansi';
import { ColorEffect, Colors, FontStyles } from '../util/text/ansi';
import Joi from 'joi';
import {
	type LocationMapQuery,
	LocationMapQueryDefinition
} from './catalog/location-map-query/location-map-query-format';
import { type ConfigQuery, ConfigQueryDefinition } from './catalog/config-query/config-query-format';
import { type SearchQuery, SearchQueryDefinition } from './catalog/search-query/search-query-format';
import {
	type HappensBeforeQuery,
	HappensBeforeQueryDefinition
} from './catalog/happens-before-query/happens-before-query-format';
import {
	type ResolveValueQuery,
	ResolveValueQueryDefinition
} from './catalog/resolve-value-query/resolve-value-query-format';
import {
	type DataflowLensQuery,
	DataflowLensQueryDefinition
} from './catalog/dataflow-lens-query/dataflow-lens-query-format';
import { type ProjectQuery, ProjectQueryDefinition } from './catalog/project-query/project-query-format';
import { type OriginQuery, OriginQueryDefinition } from './catalog/origin-query/origin-query-format';
import { type LinterQuery, LinterQueryDefinition } from './catalog/linter-query/linter-query-format';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type ControlFlowQuery,
	ControlFlowQueryDefinition
} from './catalog/control-flow-query/control-flow-query-format';
import { type DfShapeQuery, DfShapeQueryDefinition } from './catalog/df-shape-query/df-shape-query-format';
import type { AsyncOrSync, Writable } from 'ts-essentials';
import type { FlowrConfigOptions } from '../config';
import {
	type InspectHigherOrderQuery,
	InspectHigherOrderQueryDefinition
} from './catalog/inspect-higher-order-query/inspect-higher-order-query-format';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { log } from '../util/log';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../cli/repl/core';
import type { FilesQuery } from './catalog/files-query/files-query-format';
import { FilesQueryDefinition } from './catalog/files-query/files-query-format';
import type { CallGraphQuery } from './catalog/call-graph-query/call-graph-query-format';
import { CallGraphQueryDefinition } from './catalog/call-graph-query/call-graph-query-format';
import type {
	InspectRecursionQuery } from './catalog/inspect-recursion-query/inspect-recursion-query-format';
import {
	InspectRecursionQueryDefinition
} from './catalog/inspect-recursion-query/inspect-recursion-query-format';
import type { DoesCallQuery } from './catalog/does-call-query/does-call-query-format';
import { DoesCallQueryDefinition } from './catalog/does-call-query/does-call-query-format';
import type {
	InspectExceptionQuery } from './catalog/inspect-exceptions-query/inspect-exception-query-format';
import {
	InspectExceptionQueryDefinition
} from './catalog/inspect-exceptions-query/inspect-exception-query-format';

/**
 * These are all queries that can be executed from within flowR
 */
export type Query = CallContextQuery
	| ConfigQuery
	| SearchQuery
	| DataflowQuery
	| DoesCallQuery
	| CallGraphQuery
	| ControlFlowQuery
	| DataflowLensQuery
	| FilesQuery
	| DfShapeQuery
	| NormalizedAstQuery
	| IdMapQuery
	| DataflowClusterQuery
	| StaticSliceQuery
	| DependenciesQuery
	| LocationMapQuery
	| HappensBeforeQuery
	| InspectExceptionQuery
    | InspectHigherOrderQuery
	| InspectRecursionQuery
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
};

/**
 * The result of parsing a query line from, e.g., the repl.
 */
export interface ParsedQueryLine<QueryType extends BaseQueryFormat['type']> {
	/** The parsed query or queries from the line. */
	query:  QueryArgumentsWithType<QueryType> | QueryArgumentsWithType<QueryType>[] | undefined;
	/** Optional R code associated with the query. */
	rCode?: string;
}

export interface SupportedQuery<QueryType extends BaseQueryFormat['type'] = BaseQueryFormat['type']> {
	executor:             QueryExecutor<QueryArgumentsWithType<QueryType>, Promise<BaseQueryResult>>
	/** optional completion in, e.g., the repl */
	completer?:           (splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfigOptions) => CommandCompletions;
	/** optional query construction from an, e.g., repl line */
	fromLine?:            (output: ReplOutput, splitLine: readonly string[], config: FlowrConfigOptions) => ParsedQueryLine<QueryType>
	/**
	 * Generates an ASCII summary of the query result to be printed in, e.g., the REPL.
	 * @returns whether a summary was produced (`true` if so, `false` if not, in this case a default/generic summary will be created)
	 */
	asciiSummarizer:      (formatter: OutputFormatter, analyzer: ReadonlyFlowrAnalysisProvider, queryResults: BaseQueryResult, resultStrings: string[], query: readonly Query[]) => AsyncOrSync<boolean>
	jsonFormatter?:       (queryResults: BaseQueryResult) => object
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
	'call-graph':           CallGraphQueryDefinition,
	'dataflow':             DataflowQueryDefinition,
	'does-call':            DoesCallQueryDefinition,
	'dataflow-lens':        DataflowLensQueryDefinition,
	'df-shape':             DfShapeQueryDefinition,
	'files':                FilesQueryDefinition,
	'id-map':               IdMapQueryDefinition,
	'normalized-ast':       NormalizedAstQueryDefinition,
	'dataflow-cluster':     ClusterQueryDefinition,
	'static-slice':         StaticSliceQueryDefinition,
	'dependencies':         DependenciesQueryDefinition,
	'location-map':         LocationMapQueryDefinition,
	'search':               SearchQueryDefinition,
	'happens-before':       HappensBeforeQueryDefinition,
	'inspect-exception':    InspectExceptionQueryDefinition,
	'inspect-higher-order': InspectHigherOrderQueryDefinition,
	'inspect-recursion':    InspectRecursionQueryDefinition,
	'resolve-value':        ResolveValueQueryDefinition,
	'project':              ProjectQueryDefinition,
	'origin':               OriginQueryDefinition,
	'linter':               LinterQueryDefinition
} as const satisfies SupportedQueriesType;

export type SupportedQueryTypes = keyof typeof SupportedQueries;
export type QueryResult<Type extends Query['type']> = Promise<ReturnType<typeof SupportedQueries[Type]['executor']>>;

/**
 * Executes a set of queries that are all of the same type.
 * Only use this function if you are sure all queries are of the same type.
 * Otherwise, use {@link executeQueries}.
 */
export async function executeQueriesOfSameType<SpecificQuery extends Query>(data: BasicQueryData, queries: readonly SpecificQuery[]): QueryResult<SpecificQuery['type']> {
	guard(queries.length > 0, 'At least one query must be provided');
	const qzt = queries[0].type;
	/* every query must have the same type */
	guard(queries.every(q => q.type === qzt), 'All queries must have the same type');
	const query = SupportedQueries[qzt];
	guard(query !== undefined, `Unsupported query type: ${qzt}`);
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
} & BaseQueryResult;


type OmitFromValues<T, K extends string | number | symbol> = {
	[P in keyof T]?: Omit<T[P], K>
};

export type QueryResultsWithoutMeta<Queries extends Query> = OmitFromValues<Omit<QueryResults<Queries['type']>, '.meta'>, '.meta'>;

export type Queries<
	Base extends SupportedQueryTypes = SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
> = readonly (QueryArgumentsWithType<Base> | VirtualQueryArgumentsWithType<Base, VirtualArguments>)[];

/**
 * This is the main query execution function that takes a set of queries and executes them on the given data.
 * @see {@link executeQueriesOfSameType}
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
			const result = await executeQueriesOfSameType(data, group);
			results.push([type, result] as [Base, Awaited<QueryResult<Base>>]);
		} catch(e) {
			log.warn(e);
			results.push([type, undefined]);
		}
	}

	const r = Object.fromEntries(results) as Writable<QueryResults<Base>>;
	r['.meta'] = {
		timing: Date.now() - now
	};
	return r as QueryResults<Base>;
}

/**
 * Produces a Joi schema representing all supported queries.
 */
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

/**
 * Produces a Joi schema representing all virtual queries.
 */
export function VirtualQuerySchema() {
	return Joi.alternatives(
		CompoundQuerySchema
	).description('Virtual queries (used for structure)');
}

/**
 * Produces a Joi schema representing any supported query (including virtual queries).
 */
export function AnyQuerySchema() {
	return Joi.alternatives(
		SupportedQueriesSchema(),
		VirtualQuerySchema()
	).description('A virtual or an active query!');
}

/**
 * Produces a Joi schema representing an array of supported queries.
 */
export function QueriesSchema() {
	return Joi.array().items(AnyQuerySchema()).description('Queries to run on the file analysis information (in the form of an array)');
}


/**
 * Wraps a function that executes a REPL query and, if it fails, checks whether there were any requests to analyze.
 */
export async function genericWrapReplFailIfNoRequest<T>(
	fn: () => Promise<T>,
	output: ReplOutput,
	analyzer: ReadonlyFlowrAnalysisProvider
): Promise<T | undefined> {
	try {
		return await fn();
	} catch(e) {
		if(analyzer.inspectContext().files.loadingOrder.getUnorderedRequests().length === 0) {
			output.stderr(
				output.formatter.format('No requests to analyze were found.', { color: Colors.Red, style: FontStyles.Bold, effect: ColorEffect.Foreground  })
		        + '\nIf you consider this an error, please report a bug: '
				+ getGuardIssueUrl('analyzer found no requests to analyze')
			);
			output.stderr('Full error message: ' + ((e instanceof Error) ? e.message : String(e)));
		} else {
			throw e;
		}
	}
}