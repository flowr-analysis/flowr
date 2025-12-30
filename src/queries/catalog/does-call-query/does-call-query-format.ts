import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeDoesCallQuery } from './does-call-query-executor';
import { type NodeId  } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { formatRange } from '../../../util/mermaid/dfg';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { startAndEndsWith } from '../../../util/text/strings';

interface CallsIdConstraint {
	readonly type: 'calls-id';
	/** The id of the function being called. */
	readonly id:   NodeId;
}
interface CallsWithNameConstraint {
	readonly type:       'name';
	/** The name of the function being called. */
	readonly name:       string;
	/** Should we match the name exactly, or as a regex? */
	readonly nameExact?: boolean;
}

interface CallsConstraints {
	readonly type:  'and' | 'or' | 'one-of';
	/* The constraints to combine. */
	readonly calls: readonly CallsConstraint[];
}

export type CallsConstraint = CallsIdConstraint | CallsWithNameConstraint | CallsConstraints;

/**
 * Either checks whether a given function calls another function matching the given constraints,
 * or returns all functions that call any function matching the given constraints.
 */
export interface DoesCallQuery extends BaseQueryFormat {
	readonly type:     'does-call';
	// this should be a unique id if you give multiple queries of this type, to identify them in the output
	readonly queryId?: string;
	readonly call:     SingleSlicingCriterion;
	readonly calls:    CallsConstraint;
}

export interface FindAllCallsResult {
	readonly call: NodeId
}

export interface DoesCallQueryResult extends BaseQueryResult {
	/** Results are either false (does not call) or an object with details on the calls made */
	readonly results: Record<string, FindAllCallsResult | false>;
}

const FormatError = 'Invalid constraint format, expected format "(left:$id/"regex")"';
/**
 * Parses a constraint from a string argument.
 * Returns the constraint or an error message.
 */
function constraintParser(argument: string | undefined): { call: SingleSlicingCriterion, constraint: CallsWithNameConstraint | CallsIdConstraint } | string {
	if(!argument?.startsWith('(') || !argument.includes(')')) {
		return FormatError + ` (got: "${argument}")`;
	}
	const endBracket = argument.indexOf(')');
	const constrPart = argument.slice(1, endBracket);
	const args = splitAtEscapeSensitive(constrPart, true, ':');
	if(args.length !== 2) {
		return FormatError + ` (got ${args.length} parts: ${args.join(', ')})`;
	}
	const [criteria, ...rhs] = args;
	const rhsStr = rhs.join(' ');
	if(rhsStr.startsWith('$')) {
		return {
			call:       criteria as SingleSlicingCriterion,
			constraint: {
				type: 'calls-id',
				id:   rhsStr.slice(1) as SingleSlicingCriterion,
			}
		};
	} else {
		const isExact = startAndEndsWith(rhsStr, '"');
		const name = isExact ? rhsStr.slice(1, -1) : rhsStr;
		return {
			call:       criteria as SingleSlicingCriterion,
			constraint: {
				type:      'name',
				name:      name,
				nameExact: isExact ? true : undefined,
			}
		};
	}
}

function doesCallQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'does-call'> {
	const constraint = constraintParser(line[0]);
	if(!constraint || typeof constraint === 'string') {
		output.stderr(output.formatter.format(`Invalid does-call query format:\n  ${constraint}`,
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return {
		query: [
			{
				type:    'does-call',
				queryId: constraint.call + ' (shorthand)',
				call:    constraint.call,
				calls:   constraint.constraint,
			}],
		rCode: line[1]
	} ;
}


export const DoesCallQueryDefinition = {
	executor:        executeDoesCallQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		result.push(`Query: ${bold('does-call', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const [r, v] of Object.entries(out.results)) {
			const idMap = (await processed.normalize()).idMap;
			result.push(`  - ${bold(r, formatter)} found:`);
			if(v === false) {
				result.push('    - Does not call any matching functions.');
			} else {
				const loc = idMap.get(v.call)?.location ?? undefined;
				result.push(`    - Call with id ${bold(String(v.call), formatter)} (${formatRange(loc)})`);
			}
		}
		return true;
	},
	fromLine: doesCallQueryLineParser,
	schema:   Joi.object({
		type:    Joi.string().valid('does-call').required().description('The type of the query.'),
		queryId: Joi.string().optional().description('An optional unique identifier for this query, to identify it in the output.'),
		call:    Joi.string().description('The function from which calls are being made. This is a slicing criterion that resolves to a function definition node.'),
		calls:   Joi.object().required().description('The constraints on which functions are being called. This can be a combination of name-based or id-based constraints, combined with logical operators (and, or, one-of).')
	}).description('Either returns all function definitions alongside whether they are recursive, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'does-call'>['does-call'];
		return Object.entries(out.results).flatMap(([, v]) => {
			return v !== false ? v.call : [];
		});
	}
} as const satisfies SupportedQuery<'does-call'>;
