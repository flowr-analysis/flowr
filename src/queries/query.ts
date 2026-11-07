import {
	type CallContextQuery,
	type CallContextQuerySubKindResult,
	CallContextQueryDefinition
} from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryFormat, BaseQueryMeta, BaseQueryResult, BasicQueryData } from './base-query-format';
import { getGuardIssueUrl, guard } from '../util/assert';
import { SupportedVirtualQueries, type SupportedVirtualQueryTypes, type VirtualQueryArgumentsWithType } from './virtual-query/virtual-queries';
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
import { type SignatureQuery, SignatureQueryDefinition } from './catalog/signature-query/signature-query-format';
import { type OriginQuery, OriginQueryDefinition } from './catalog/origin-query/origin-query-format';
import { type LinterQuery, LinterQueryDefinition } from './catalog/linter-query/linter-query-format';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type ControlFlowQuery,
	ControlFlowQueryDefinition
} from './catalog/control-flow-query/control-flow-query-format';
import type { AsyncOrSync } from 'ts-essentials';
import { deepMergeObject, type MergeableRecord } from '../util/objects';
import type { FlowrConfig } from '../config';
import {
	type InspectHigherOrderQuery,
	InspectHigherOrderQueryDefinition
} from './catalog/inspect-higher-order-query/inspect-higher-order-query-format';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { log } from '../util/log';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import { missingRootsWithoutRequests } from './query-print';
import type { CommandCompletions } from '../cli/repl/completion';
import type { FilesQuery } from './catalog/files-query/files-query-format';
import { FilesQueryDefinition } from './catalog/files-query/files-query-format';
import type { CallGraphQuery } from './catalog/call-graph-query/call-graph-query-format';
import { CallGraphQueryDefinition } from './catalog/call-graph-query/call-graph-query-format';
import type {
	InspectRecursionQuery } from './catalog/inspect-recursion-query/inspect-recursion-query-format';
import {
	InspectRecursionQueryDefinition
} from './catalog/inspect-recursion-query/inspect-recursion-query-format';
import type {
	InspectFnPropsQuery } from './catalog/inspect-fn-props-query/inspect-fn-props-query-format';
import {
	InspectFnPropsQueryDefinition
} from './catalog/inspect-fn-props-query/inspect-fn-props-query-format';
import type { DoesCallQuery } from './catalog/does-call-query/does-call-query-format';
import { DoesCallQueryDefinition } from './catalog/does-call-query/does-call-query-format';
import type {
	InspectExceptionQuery } from './catalog/inspect-exceptions-query/inspect-exception-query-format';
import {
	InspectExceptionQueryDefinition
} from './catalog/inspect-exceptions-query/inspect-exception-query-format';
import type {
	InputSourcesQuery,
} from './catalog/input-sources-query/input-sources-query-format';
import {
	InputSourcesDefinition
} from './catalog/input-sources-query/input-sources-query-format';
import type { ProvenanceQuery } from './catalog/provenance-query/provenance-query-format';
import { ProvenanceQueryDefinition } from './catalog/provenance-query/provenance-query-format';
import type { TaintQuery } from './catalog/taint-query/taint-query-format';
import { TaintQueryDefinition } from './catalog/taint-query/taint-query-format';
import type { LintingResult, LintingResultCertainty } from '../linter/linter-format';
import { type DiceQuery, DiceQueryDefinition } from './catalog/dice-query/dice-query-format';
import {
	type GuessDepVersionsQuery,
	GuessDepVersionsQueryDefinition
} from './catalog/guess-dep-versions-query/guess-dep-versions-query-format';
import { AbsintQueryDefinition, type AbsintQuery } from './catalog/absint-query/absint-query-format';
import { type CodeClonesQuery, CodeClonesQueryDefinition } from './catalog/code-clones-query/code-clones-query-format';
import {
	type FunctionInfoQuery,
	FunctionInfoQueryDefinition
} from './catalog/function-info-query/function-info-query-format';

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
	| AbsintQuery
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
	| InspectFnPropsQuery
	| ResolveValueQuery
	| ProjectQuery
	| SignatureQuery
	| OriginQuery
	| LinterQuery
	| ProvenanceQuery
	| InputSourcesQuery
	| TaintQuery
	| DiceQuery
	| GuessDepVersionsQuery
	| FunctionInfoQuery
	| CodeClonesQuery
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
	executor:              QueryExecutor<QueryArgumentsWithType<QueryType>, Promise<BaseQueryResult>>
	/** optional completion in, e.g., the repl */
	completer?:            (splitLine: readonly string[], startingNewArg: boolean, config: FlowrConfig) => CommandCompletions;
	/** optional query construction from an, e.g., repl line */
	fromLine?:             (output: ReplOutput, splitLine: readonly string[], config: FlowrConfig) => ParsedQueryLine<QueryType>
	/** optional one-line usage of the repl `@`-shorthand `fromLine` accepts, shown by `:query ?<type>` */
	syntax?:               string
	/** the human-readable name, e.g. `Call-Context Query`; also names its wiki page, see {@link queryWikiPage} */
	title:                 string
	/**
	 * Generates an ASCII summary of the query result to be printed in, e.g., the REPL.
	 * @returns whether a summary was produced (`true` if so, `false` if not, in this case a default/generic summary will be created)
	 */
	asciiSummarizer:       (formatter: OutputFormatter, analyzer: ReadonlyFlowrAnalysisProvider, queryResults: BaseQueryResult, resultStrings: string[], query: readonly Query[]) => AsyncOrSync<boolean>
	jsonFormatter?:        (queryResults: BaseQueryResult) => object
	schema:                Joi.ObjectSchema
	/**
	 * Flattens the involved query nodes to be added to a flowR search when the {@link fromQuery} function is used based on the given result after this query is executed.
	 * If this query does not involve any nodes, this can be omitted.
	 */
	flattenInvolvedNodes?: (queryResults: BaseQueryResult, query: readonly Query[], certainty?: LintingResultCertainty) => NodeId[]
	/** each query of this type reports exactly one entry in the `results` of its result, which {@link Query.one} answers with */
	perQueryResults?:      true
}

export const SupportedQueries = {
	'call-context':         CallContextQueryDefinition,
	'config':               ConfigQueryDefinition,
	'control-flow':         ControlFlowQueryDefinition,
	'call-graph':           CallGraphQueryDefinition,
	'dataflow':             DataflowQueryDefinition,
	'does-call':            DoesCallQueryDefinition,
	'dataflow-lens':        DataflowLensQueryDefinition,
	'absint':               AbsintQueryDefinition,
	'taint':                TaintQueryDefinition,
	'files':                FilesQueryDefinition,
	'id-map':               IdMapQueryDefinition,
	'normalized-ast':       NormalizedAstQueryDefinition,
	'dataflow-cluster':     ClusterQueryDefinition,
	'static-slice':         StaticSliceQueryDefinition,
	'provenance':           ProvenanceQueryDefinition,
	'input-sources':        InputSourcesDefinition,
	'dependencies':         DependenciesQueryDefinition,
	'location-map':         LocationMapQueryDefinition,
	'search':               SearchQueryDefinition,
	'happens-before':       HappensBeforeQueryDefinition,
	'inspect-exception':    InspectExceptionQueryDefinition,
	'inspect-higher-order': InspectHigherOrderQueryDefinition,
	'inspect-recursion':    InspectRecursionQueryDefinition,
	'inspect-fn-props':     InspectFnPropsQueryDefinition,
	'resolve-value':        ResolveValueQueryDefinition,
	'project':              ProjectQueryDefinition,
	'signature':            SignatureQueryDefinition,
	'origin':               OriginQueryDefinition,
	'linter':               LinterQueryDefinition,
	'dice':                 DiceQueryDefinition,
	'guess-dep-versions':   GuessDepVersionsQueryDefinition,
	'function-info':        FunctionInfoQueryDefinition,
	'code-clones':          CodeClonesQueryDefinition
} as const satisfies SupportedQueriesType;

export type SupportedQueryTypes = keyof typeof SupportedQueries;

/** The wiki page documenting a query, derived from its {@link SupportedQuery.title}. */
export function queryWikiPage(title: string): string {
	return '[Query] ' + title.replace(/\s*Query$/, '');
}
export type QueryResult<Type extends Query['type']> = Promise<ReturnType<typeof SupportedQueries[Type]['executor']>>;

/**
 * Executes a set of queries that are all of the same type.
 * Only use this function if you are sure all queries are of the same type.
 * Otherwise, use {@link executeQueries}, and {@link Query.one} for a single query.
 */
export async function executeQueriesOfSameType<SpecificQuery extends Query>(data: BasicQueryData, queries: readonly SpecificQuery[]): QueryResult<SpecificQuery['type']> {
	guard(queries.length > 0, 'At least one query must be provided');
	const qzt = queries[0].type;
	guard(queries.every(q => q.type === qzt), 'All queries must have the same type');
	return runExecutor(data, qzt, queries) as QueryResult<SpecificQuery['type']>;
}

function runExecutor(data: BasicQueryData, type: SupportedQueryTypes, queries: readonly Query[]): Promise<BaseQueryResult> {
	const definition = SupportedQueries[type] as SupportedQuery | undefined;
	guard(definition !== undefined, `Unsupported query type: ${type}`);
	return definition.executor(data, queries as never);
}

/** Groups the queries by type in the order the types first occur, unfolding virtual queries into the queries they stand for. */
function groupQueriesByType(queries: Queries): Map<SupportedQueryTypes, Query[]> {
	const grouped = new Map<SupportedQueryTypes, Query[]>();
	function add(query: Query) {
		const group = grouped.get(query.type);
		if(group) {
			group.push(query);
		} else {
			grouped.set(query.type, [query]);
		}
	}
	for(const query of queries) {
		const virtual = SupportedVirtualQueries[query.type as SupportedVirtualQueryTypes];
		if(virtual) {
			for(const subQuery of virtual(query as never)) {
				add(subQuery);
			}
		} else {
			add(query as Query);
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
 * Queries of the same type run as one batch, and a failing batch is retried query by query, so it does not
 * discard the results of other queries.
 * @see {@link Query.one} - to run a single query and get its result directly
 */
export async function executeQueries<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(data: BasicQueryData, queries: Queries<Base, VirtualArguments>): Promise<QueryResults<Base>> {
	const start = Date.now();
	const results: Record<string, BaseQueryResult | BaseQueryMeta> = {};
	for(const [type, group] of groupQueriesByType(queries)) {
		try {
			results[type] = await runExecutor(data, type, group);
		} catch(e) {
			const message = errorMessage(e);
			log.error(`query of type '${type}' failed: ${message.split('\n')[0]}`);
			results[type] = await retryQueriesIndividually(data, group, message);
		}
	}
	results['.meta'] = { timing: Date.now() - start };
	return results as unknown as QueryResults<Base>;
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Re-runs the queries of a batch that failed as a whole one by one, so a faulty query does not discard its
 * siblings' results. Merges everything computed and carries the errors of the queries that still failed.
 */
async function retryQueriesIndividually(data: BasicQueryData, group: readonly Query[], fallback: string): Promise<BaseQueryResult> {
	if(group.length <= 1) {
		return { '.meta': { timing: 0 }, error: fallback } as BaseQueryResult;
	}
	const errors: string[] = [];
	let merged: BaseQueryResult | undefined;
	for(const query of group) {
		try {
			const result = await runExecutor(data, query.type, [query]);
			merged = merged === undefined ? result : deepMergeObject(merged as unknown as MergeableRecord, result as unknown as MergeableRecord) as unknown as BaseQueryResult;
		} catch(e) {
			errors.push(errorMessage(e));
		}
	}
	const error = errors.length > 0 ? errors.join('\n') : fallback;
	return merged === undefined ? { '.meta': { timing: 0 }, error } as BaseQueryResult : { ...merged, error } as BaseQueryResult;
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
		const missing = missingRootsWithoutRequests(analyzer);
		if(missing !== undefined) {
			if(missing.length > 0) {
				output.stderr(output.formatter.format(`Path does not exist: ${missing.map(p => `'${p}'`).join(', ')}`, { color: Colors.Red, style: FontStyles.Bold, effect: ColorEffect.Foreground }));
				return;
			}
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

/** What a query reports per key, for the queries that report anything per key. */
type ResultsOf<Type extends SupportedQueryTypes> =
	Awaited<QueryResult<Type>> extends { readonly results: infer R } ? R : never;

/** The keys {@link ResultsOf} is indexed by, e.g. the slicing criterion a slice was taken at. */
type KeyOf<Type extends SupportedQueryTypes> = Extract<keyof ResultsOf<Type>, string>;

/** What one key of {@link ResultsOf} holds, e.g. one slice with its reconstruction. */
type ValueOf<Type extends SupportedQueryTypes> = ResultsOf<Type>[KeyOf<Type>];

/**
 * What {@link Query.one} answers a single query of the given type with: the one entry of its `results` for a
 * query marked {@link SupportedQuery#perQueryResults}, its full result otherwise.
 */
export type SingleQueryResult<Type extends SupportedQueryTypes> =
	typeof SupportedQueries[Type] extends { readonly perQueryResults: true } ? ValueOf<Type> : Awaited<QueryResult<Type>>;

/** One call a `call-context` query found, with the kind and subkind it was found under. */
export interface FoundCall extends CallContextQuerySubKindResult {
	readonly kind:    string;
	readonly subkind: string;
}

/** One finding a `linter` query reported, with the rule that reported it. */
export interface FoundLint {
	readonly rule:   string;
	readonly result: LintingResult;
}

/**
 * Running queries and reading what they reported, without `Object.entries` and the casts it forces. Reading
 * changes nothing: the results keep the shape they are serialized in.
 * @helper api
 * @example
 * ```ts
 * const out = await executeQueries({ analyzer }, [{ type: 'static-slice', criteria: ['2@x'] }]);
 * Query.get(out, 'static-slice', '2@x');                       // the slice taken at `2@x`
 * Query.first(out, 'static-slice');                            // the only slice, when one was asked for
 * for(const [criterion, slice] of Query.entries(out, 'static-slice')) { ... }
 * ```
 */
export const Query = {
	name: 'Query',
	/**
	 * Run a single query and answer with what it reported, without grouping, retries, or a {@link QueryResults}
	 * to index into. For a query marked {@link SupportedQuery#perQueryResults}, this is the one entry of its
	 * `results`, e.g. the slice and reconstruction of a `static-slice` query. A failing query throws.
	 * @example
	 * ```ts
	 * const { slice, reconstruct } = await Query.one({ analyzer }, { type: 'static-slice', criteria: ['2@x'] });
	 * ```
	 */
	async one<Type extends SupportedQueryTypes>(
		this: void, data: BasicQueryData, query: QueryArgumentsWithType<Type>
	): Promise<SingleQueryResult<Type>> {
		const definition = SupportedQueries[query.type] as SupportedQuery;
		const result = await runExecutor(data, query.type, [query]);
		if(!definition.perQueryResults) {
			return result as SingleQueryResult<Type>;
		}
		const results = (result as BaseQueryResult & { readonly results: Readonly<Record<string, unknown>> }).results;
		for(const key in results) {
			return results[key] as SingleQueryResult<Type>;
		}
		return undefined as SingleQueryResult<Type>;
	},
	/** Every key and result of one query, typed as that query reports them. */
	entries<Base extends SupportedQueryTypes, Type extends Base>(
		this: void, results: QueryResults<Base>, type: Type
	): [KeyOf<Type>, ValueOf<Type>][] {
		const found = results[type] as { results?: Record<string, unknown> } | undefined;
		return Object.entries(found?.results ?? {}) as [KeyOf<Type>, ValueOf<Type>][];
	},
	/** Every result of one query, for when the keys are not what you are after. */
	values<Base extends SupportedQueryTypes, Type extends Base>(
		this: void, results: QueryResults<Base>, type: Type
	): ValueOf<Type>[] {
		return Query.entries(results, type).map(([, value]) => value);
	},
	/** The result of one query under one key, `undefined` when it reported none. */
	get<Base extends SupportedQueryTypes, Type extends Base>(
		this: void, results: QueryResults<Base>, type: Type, key: KeyOf<Type>
	): ValueOf<Type> | undefined {
		const found = results[type] as { results?: Record<string, unknown> } | undefined;
		return found?.results?.[key] as ValueOf<Type> | undefined;
	},
	/** The one result of a query that was asked for one thing, `undefined` when it reported none. */
	first<Base extends SupportedQueryTypes, Type extends Base>(
		this: void, results: QueryResults<Base>, type: Type
	): ValueOf<Type> | undefined {
		return Query.values(results, type)[0];
	},
	/**
	 * Every call a `call-context` query found, flat, each carrying the kind and subkind it was found under
	 * rather than leaving them as the two levels of record the result nests them in.
	 */
	calls(this: void, results: Partial<QueryResults<'call-context'>>): FoundCall[] {
		const found: FoundCall[] = [];
		for(const [kind, { subkinds }] of Object.entries(results['call-context']?.kinds ?? {})) {
			for(const [subkind, hits] of Object.entries(subkinds)) {
				for(const hit of hits) {
					found.push({ ...hit, kind, subkind });
				}
			}
		}
		return found;
	},
	/** Every finding a `linter` query reported, flat, each carrying the rule that reported it. */
	lints(this: void, results: Partial<QueryResults<'linter'>>): FoundLint[] {
		const found: FoundLint[] = [];
		for(const [rule, reported] of Object.entries(results['linter']?.results ?? {})) {
			for(const result of (reported as { results?: readonly LintingResult[] }).results ?? []) {
				found.push({ rule, result });
			}
		}
		return found;
	}
};
