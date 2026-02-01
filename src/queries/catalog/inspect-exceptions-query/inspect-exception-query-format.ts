import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeExceptionQuery } from './inspect-exception-query-executor';
import { type NodeId, normalizeIdToNumberIfPossible } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { formatRange } from '../../../util/mermaid/dfg';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import type { SourceRange } from '../../../util/range';
import type { ExceptionPoint } from '../../../dataflow/fn/exceptions-of-function';
import { happensInEveryBranch } from '../../../dataflow/info';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';

/**
 * Either returns all function definitions alongside exception information,
 * or just those matching the filters.
 */
export interface InspectExceptionQuery extends BaseQueryFormat {
	readonly type:    'inspect-exception';
	/** If given, only function definitions that match one of the given slicing criteria are considered. */
	readonly filter?: SingleSlicingCriterion[];
}

export interface InspectExceptionQueryResult extends BaseQueryResult {
	/**
	 * If a function throws exceptions, the Ids of the throwing functions (at least the functions flowr knows about).
	 * An empty array means the function does not throw any exceptions.
	 */
	readonly exceptions: Record<NodeId, ExceptionPoint[]>;
}

function inspectExceptionLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'inspect-exception'> {
	const criteria = sliceCriteriaParser(line[0]);
	return {
		query: {
			type:   'inspect-exception',
			filter: criteria
		},
		rCode: criteria ? line[1] : line[0]
	};
}

export const InspectExceptionQueryDefinition = {
	executor:        executeExceptionQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-exception'>['inspect-exception'];
		result.push(`Query: ${bold('inspect-exception', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const n = await processed.normalize();
		function getLoc(r: NodeId): SourceRange | undefined {
			return n.idMap.get(normalizeIdToNumberIfPossible(r))?.location ?? undefined;
		}
		function getLexeme(r: NodeId): string {
			return n.idMap.get(normalizeIdToNumberIfPossible(r))?.lexeme ?? String(r);
		}
		for(const [r, v] of Object.entries(out.exceptions)) {
			result.push(`  - Function ${bold(r, formatter)} (${formatRange(getLoc(r))}) ${v.length > 0 ? 'throws exceptions:' : 'does not throw exceptions.'}`);
			for(const { id: ex, cds } of v) {
				result.push(`      - Exception ${happensInEveryBranch(cds) ? 'always ' : 'maybe '}thrown at id ${bold(String(ex), formatter)} "${getLexeme(ex)}" (${formatRange(getLoc(ex))}, cds: ${cds?.map(c => c.when + ':' + formatRange(getLoc(c.id))).join(', ') ?? 'none'})`);
			}
		}
		return true;
	},
	fromLine: inspectExceptionLineParser,
	schema:   Joi.object({
		type:   Joi.string().valid('inspect-exception').required().description('The type of the query.'),
		filter: Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.'),
	}).description('Query to inspect which functions throw exceptions.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-exception'>['inspect-exception'];
		return Object.keys(out.exceptions).filter(id => out.exceptions[id].length > 0);
	}
} as const satisfies SupportedQuery<'inspect-exception'>;
