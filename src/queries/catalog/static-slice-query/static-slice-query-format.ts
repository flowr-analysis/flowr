import type { BrandedNamespace } from '../../../dataflow/environments/identifier';
import { type BasicQueryData, type BaseQueryFormat, type BaseQueryResult, invalidQueryLine } from '../../base-query-format';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE, DEFAULT_SLICING_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { StaticSliceFlags, criteriaQueryCompleter, describeSliceFlags, queryLineCode, sliceCriteriaParser, sliceDirectionParser, sliceQueryOptionsParser, sliceRemovalParser, warnAboutSliceFlags } from '../../../cli/repl/parser/slice-query-parser';
import { summarizeSliceResults, type SliceQueryOptions, SliceQueryOptionsSchema, reconstructSlice, resolveSliceCriteria, sliceResultKey, sliceResultKeys, timedSliceEntry } from '../slice-query-options';
import { SliceDirection } from '../../../util/slice-direction';
import { staticSlice } from '../../../slicing/static/static-slicer';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { keptAfterRemoval, staticRemovalSlice } from '../../../slicing/static/removal-slice';
import type { DependencyInfo } from '../dependencies-query/dependencies-query-format';

/** what a static slice is of, which is what its result is keyed by when it was given no name */
const slicedBy = (query: StaticSliceQuery): string => query.criteria.join(',');

/**
 * The key a static slice query's result is reported under: the {@link SliceQueryOptions#name|name} it was given,
 * else what it slices. Within a request use {@link sliceResultKeys}, which settles two queries wanting one key.
 */
export function fingerPrintOfQuery(query: StaticSliceQuery): string {
	return sliceResultKey(query, slicedBy);
}

/**
 * Execute static slice queries, catching duplicates with the same fingerprint
 * @param analyzer - The basic query data containing the analyzer
 * @param queries  - The static slice queries to execute
 * @returns        The results of the static slice queries
 */
export async function executeStaticSliceQuery({ analyzer }: BasicQueryData, queries: readonly StaticSliceQuery[]): Promise<StaticSliceQueryResult> {
	const start = Date.now();
	const results: StaticSliceQueryResult['results'] = {};
	const keys = sliceResultKeys(queries, slicedBy);
	for(const [at, query] of queries.entries()) {
		const key = keys[at];
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, includeCallees } = query;
		const sliceStart = Date.now();
		const n = await analyzer.normalize();
		const df = await analyzer.dataflow();
		const ids = resolveSliceCriteria(criteria, n);
		const threshold = analyzer.flowrConfig.solver.slicer?.threshold;
		if(query.removal) {
			/* the plots, devices and saves the dependencies state are what a removed plot takes along */
			const dependencies = await analyzer.query({ type: 'dependencies' });
			const removed = staticRemovalSlice(analyzer.inspectContext(), df, n, ids, Object.values(dependencies).filter(Array.isArray).flat() as DependencyInfo[], threshold).result;
			const kept = keptAfterRemoval(n, removed);
			results[key] = timedSliceEntry(query, { timesHitThreshold: 0, result: removed, slicedFor: ids }, Date.now() - sliceStart,
				() => reconstructSlice(n, df.graph, kept, query));
			continue;
		}
		const slice = staticSlice({ ctx: analyzer.inspectContext(), info: df, ast: n, ids, direction: query.direction ?? SliceDirection.Backward, threshold, includeCallees });
		const packages = query.reportPackages ? [...Dataflow.packagesOf(slice.result, df.graph)] : undefined;
		results[key] = { packages, ...timedSliceEntry(query, slice, Date.now() - sliceStart,
			() => reconstructSlice(n, df.graph, slice.result, query)) };
	}
	return {
		...metaSince(start),
		results
	};
}

/** Calculates and returns the static backward or forward slice from the given criteria */
export interface StaticSliceQuery extends BaseQueryFormat, SliceQueryOptions {
	readonly type:       'static-slice';
	/** The slicing criteria to use */
	readonly criteria:   SlicingCriteria,
	/** The direction to slice in. Defaults to backward slicing if unset. */
	readonly direction?: SliceDirection
	/**
	 * Compute the removal slice instead (see {@link staticRemovalSlice}): the code that only exists for the criteria,
	 * which can go while the rest keeps working. The result holds the removed statements, and the reconstruction is the
	 * program without them. Ignores the {@link StaticSliceQuery#direction|direction}.
	 */
	readonly removal?:   boolean
}

/** One slice: the sliced ids, and the reconstructed code unless the query asked for {@link SliceQueryOptions#noReconstruction}. */
export type StaticSliceResult = Omit<PipelineOutput<typeof DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE>, keyof PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>>
	& Partial<Pick<PipelineOutput<typeof DEFAULT_SLICING_PIPELINE>, 'reconstruct'>>
	/** the packages the slice calls into, only set with {@link SliceQueryOptions#reportPackages} */
	& { packages?: readonly BrandedNamespace[] };

export interface StaticSliceQueryResult extends BaseQueryResult {
	/**
	 * only contains the results of the slice steps to not repeat ourselves, this does not contain the reconstruction
	 * if you set the {@link SliceQueryOptions#noReconstruction|noReconstruction} flag.
	 *
	 * The keys are the {@link SliceQueryOptions#name|name} each query was given, and the serialized query
	 * (i.e., the result of `JSON.stringify`) for the ones given none. Without a name, multiple slice queries
	 * with the same query configuration are therefore _not_ re-executed.
	 */
	results: Record<string, StaticSliceResult>
}

const SliceCriterionHelp = [
	'Each criterion picks one element of the program, separate multiple ones with ";":',
	'  <line>@<name>       <name> in line <line>, preferring a call over the symbol (e.g. 2@x)',
	'  <line>@[<n>]<name>  the n-th occurrence of <name> in line <line> (e.g. 2@[2]x, 2@[-1]x)',
	'  <line>:<col>        the element starting at line <line>, column <col> (e.g. 2:5)',
	'  <line>~<col>        the innermost element containing line <line>, column <col> (e.g. 2~5)',
	'  <line>^             the top-level statement line <line> belongs to (e.g. 2^)',
	'  $<id>               the normalized node with the id <id> (e.g. $42)',
	'A negative <line> counts from the end; a trailing (file-regex) restricts to a file (e.g. 2@x(tmp/.*)).',
	`Append flags after the ")": ${describeSliceFlags(StaticSliceFlags)}.`,
	'Example: :query @static-slice (2@x;3:1)fc'
].join('\n');

function sliceQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'static-slice'> {
	const criteria = sliceCriteriaParser(line[0]);
	const direction = sliceDirectionParser(line[0]);
	const options = sliceQueryOptionsParser(line[0]);
	if(!criteria || criteria.length === 0) {
		return invalidQueryLine(output, 'Invalid static-slice query format, slicing criteria must be given in the form "(criterion1;criterion2;...)"', SliceCriterionHelp);
	}
	warnAboutSliceFlags(output, line[0], StaticSliceFlags);

	return { query: [
		{
			type:      'static-slice',
			criteria:  criteria,
			direction: direction,
			...options,
			...sliceRemovalParser(line[0]) ? { removal: true } : {}
		}], rCode: queryLineCode(line) };
}

export const StaticSliceQueryDefinition = {
	title:           'Static Slice Query',
	executor:        executeStaticSliceQuery,
	perQueryResults: true,
	asciiSummarizer: (formatter, _analyzer, queryResults, result): boolean => summarizeSliceResults<StaticSliceQuery>(
		formatter, 'static-slice', queryResults as QueryResults<'static-slice'>['static-slice'], result,
		(key, q) => `Slice ${q === undefined ? `"${key}"` : `for {${q.criteria.join(', ')}}`}`
	),
	fromLine:  sliceQueryLineParser,
	completer: criteriaQueryCompleter,
	syntax:    `@static-slice (<crit>;...)[${StaticSliceFlags.map(f => f.flag).join('')}] <code | file://path>`,
	schema:    Joi.object({
		type:      Joi.string().valid('static-slice').required().description('The type of the query.'),
		criteria:  Joi.array().items(Joi.string()).min(0).required().description('The slicing criteria to use.'),
		direction: Joi.string().valid(...Object.values(SliceDirection)).optional().description('The direction to slice in. Defaults to backward slicing if unset.'),
		removal:   Joi.boolean().optional().description('Compute the removal slice instead: the code that only exists for the criteria, which can go while the rest keeps working. The result holds the removed statements, the reconstruction the program without them.'),
		...SliceQueryOptionsSchema
	}).description('Slice query used to slice the dataflow graph'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'static-slice'>['static-slice'];
		for(const [_, obj] of Object.entries(out.results)) {
			flattened.push(...obj.slice.result);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'static-slice'>;
