import Joi from 'joi';
import { filterLineParser, type BasicQueryData, type BaseQueryFormat, type BaseQueryResult } from './base-query-format';
import type { SupportedQuery } from './query';
import { criteriaQueryCompleter } from '../cli/repl/parser/slice-query-parser';
import { bold } from '../util/text/ansi';
import { metaSince } from './query-meta';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../slicing/criterion/parse';
import { SourceLocation } from '../util/range';

/** The `filter` property shared by the `inspect-*` queries. */
export const FunctionFilterSchema = Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.');

/** Defines an `inspect-*` query that states one boolean property per function definition, stored under `resultKey`. */
export function functionPropertyQuery<const T extends string, const K extends string, Q extends BaseQueryFormat & { readonly type: T, readonly filter?: readonly SlicingCriterion[] }>(spec: {
	readonly type:      T
	readonly title:     string
	readonly noun:      string
	readonly resultKey: K
	readonly phrase:    string
	readonly compute:   (data: BasicQueryData, queries: readonly Q[]) => Promise<Record<NodeId, boolean>>
}) {
	type Result = BaseQueryResult & Record<K, Record<NodeId, boolean>>;
	return {
		title:    spec.title,
		executor: async(data: BasicQueryData, queries: readonly Q[]): Promise<Result> => {
			const start = Date.now();
			return { ...metaSince(start), [spec.resultKey]: await spec.compute(data, queries) } as Result;
		},
		asciiSummarizer: (async(formatter, processed, queryResults, result) => {
			const out = queryResults as Result;
			result.push(`Query: ${bold(spec.type, formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
			for(const [r, v] of Object.entries(out[spec.resultKey])) {
				const node = (await processed.normalize()).idMap.get(NodeId.normalize(r));
				const loc = node ? SourceLocation.fromNode(node) : undefined;
				result.push(`  - Function ${bold(r, formatter)} (${SourceLocation.format(loc)}) is ${v ? '' : 'not '}${spec.phrase}`);
			}
			return true;
		}) satisfies SupportedQuery['asciiSummarizer'],
		completer: criteriaQueryCompleter,
		fromLine:  filterLineParser(spec.type),
		syntax:    `@${spec.type} [(<crit>;...)] <code | file://path>`,
		schema:    Joi.object({
			type:   Joi.string().valid(spec.type).required().description('The type of the query.'),
			filter: FunctionFilterSchema
		}).description(`Either returns all function definitions alongside whether they are ${spec.noun}, or just those matching the filters.`),
		flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
			const out = (queryResults as Result)[spec.resultKey];
			return Object.keys(out).filter(id => out[id]);
		}
	} as const;
}
