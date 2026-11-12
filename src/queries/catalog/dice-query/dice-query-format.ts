import { type BasicQueryData, type BaseQueryFormat, type BaseQueryResult, invalidQueryLine } from '../../base-query-format';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/completion';
import type { FlowrConfig } from '../../../config';
import { SharedSliceFlags, diceCriteriaParser, queryLineCode, sliceFlagCompletions, sliceQueryOptionsParser, warnAboutSliceFlags } from '../../../cli/repl/parser/slice-query-parser';
import { type SliceQueryOptions, SliceQueryOptionsSchema, summarizeSliceResults, reconstructSlice, resolveSliceCriteria, sliceResultKeys, timedSliceEntry } from '../slice-query-options';
import { metaSince } from '../../query-meta';
import { staticDice } from '../../../slicing/static/static-slicer';
import { log } from '../../../util/log';

/**
 * Execute dice queries. Each dice computes the intersection of a forward slice from `from`
 * and a backward slice from `to`, yielding only those program points that lie on a path
 * from the start criteria to the end criteria.
 */
export async function executeDiceQuery({ analyzer }: BasicQueryData, queries: readonly DiceQuery[]): Promise<DiceQueryResult> {
	const start = Date.now();
	const results: DiceQueryResult['results'] = {};
	const ast = await analyzer.normalize();
	const df = await analyzer.dataflow();

	const keys = sliceResultKeys(queries, query => `${query.from.join(',')}->${query.to.join(',')}`);
	for(const [at, query] of queries.entries()) {
		const key = keys[at];
		if(results[key]) {
			log.warn(`Duplicate key for dice-query: ${key}, skipping...`);
			continue;
		}

		const { from, to, includeCallees } = query;
		const startIds = resolveSliceCriteria(from, ast);
		const endIds = resolveSliceCriteria(to, ast);

		const sliceStart = Date.now();
		const slice = staticDice(analyzer.inspectContext(), df, ast, startIds, endIds, analyzer.flowrConfig.solver.slicer?.threshold, includeCallees);
		results[key] = timedSliceEntry(query, slice, Date.now() - sliceStart,
			() => reconstructSlice(ast, df.graph, slice.result, query));
	}

	return {
		...metaSince(start),
		results
	};
}

/**
 * Computes a program dice: only those parts that lie on a path from the given start nodes to the given end nodes.
 * Equivalent to the intersection of a forward slice from `from` and a backward slice from `to`.
 */
export interface DiceQuery extends BaseQueryFormat, SliceQueryOptions {
	readonly type: 'dice';
	/** Slicing criteria for the start of the dice (forward slice seeds) */
	readonly from: SlicingCriteria;
	/** Slicing criteria for the end of the dice (backward slice seeds) */
	readonly to:   SlicingCriteria;
}

export interface DiceQueryResult extends BaseQueryResult {
	results: Record<string, {
		slice: {
			timesHitThreshold: number;
			result:            ReadonlySet<NodeId>;
			slicedFor:         readonly NodeId[];
			/** see {@link SliceResult.stoppedEarly} */
			stoppedEarly?:     boolean;
			'.meta':           { timing: number };
		};
		reconstruct?: {
			code:    string | string[];
			'.meta': { timing: number };
		};
	}>;
}

const diceFormat = '(from1;from2->to1;to2)';

function diceQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'dice'> {
	const parsed = diceCriteriaParser(line[0]);
	if(!parsed) {
		return invalidQueryLine(output, `Invalid dice query format. Expected ${diceFormat}, e.g. (2@x->12@x) or (1@a;2@b->5@c).`);
	}
	warnAboutSliceFlags(output, line[0], SharedSliceFlags);
	return {
		query: [{ type: 'dice', from: parsed.from, to: parsed.to, ...sliceQueryOptionsParser(line[0]) }],
		rCode: queryLineCode(line)
	};
}

function diceQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	if(line.length === 0) {
		return { completions: ['('] };
	}
	if(startingNewArg || line.length !== 1) {
		return { completions: [] };
	}
	const arg = line[0];
	const flags = sliceFlagCompletions(arg, SharedSliceFlags);
	if(flags) {
		return flags;
	}
	const hasArrow = arg.includes('->');
	const side = hasArrow ? arg.slice(arg.indexOf('->') + 2) : arg.slice(1);
	const fragment = side.slice(side.lastIndexOf(';') + 1);
	if(/^\d+$/.test(fragment)) {
		return { completions: [`${arg}@`], argumentPart: arg };
	}
	if(/^\d+@\w+$/.test(fragment)) {
		return { completions: [hasArrow ? `${arg}) ` : `${arg}->`], argumentPart: arg };
	}
	return { completions: [] };
}

export const DiceQueryDefinition = {
	title:           'Dice Query',
	executor:        executeDiceQuery,
	perQueryResults: true,
	asciiSummarizer: (formatter, _analyzer, queryResults, result): boolean => summarizeSliceResults<DiceQuery>(
		formatter, 'dice', queryResults as QueryResults<'dice'>['dice'], result,
		(_, q) => q ? `Dice from {${q.from.join(', ')}} to {${q.to.join(', ')}}` : 'Dice'
	),
	fromLine:  diceQueryLineParser,
	completer: diceQueryCompleter,
	syntax:    `@dice (<crit>;...->crit;...)[${SharedSliceFlags.map(f => f.flag).join('')}] <code | file://path>`,
	schema:    Joi.object({
		type: Joi.string().valid('dice').required().description('The type of the query.'),
		from: Joi.array().items(Joi.string()).min(1).required().description('Slicing criteria for the start of the dice (forward slice seeds).'),
		to:   Joi.array().items(Joi.string()).min(1).required().description('Slicing criteria for the end of the dice (backward slice seeds).'),
		...SliceQueryOptionsSchema
	}).description('Dice query: selects only paths from the given start nodes that reach the given end nodes.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'dice'>['dice'];
		for(const [, obj] of Object.entries(out.results)) {
			flattened.push(...obj.slice.result);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'dice'>;
