import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeDiceQuery } from './dice-query-executor';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/core';
import type { FlowrConfig } from '../../../config';
import { SharedSliceFlags, diceCriteriaParser, queryLineCode, sliceFlagCompletions, sliceQueryOptionsParser, warnAboutSliceFlags } from '../../../cli/repl/parser/slice-query-parser';
import { type SliceQueryOptions, SliceQueryOptionsSchema } from '../slice-query-options';

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
		output.stderr(output.formatter.format(
			`Invalid dice query format. Expected ${diceFormat}, e.g. (2@x->12@x) or (1@a;2@b->5@c).`,
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }
		));
		return { query: [] };
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
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'dice'>['dice'];
		if(Object.keys(out.results).length === 1) {
			const [, obj] = Object.entries(out.results)[0];
			const rec = obj.reconstruct;
			if(rec !== undefined) {
				const code = Array.isArray(rec.code) ? rec.code : [rec.code];
				if(code.length === 1) {
					result.push(code[0]);
					return true;
				}
			}
		}
		result.push(`Query: ${bold('dice', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { from, to, noReconstruction, noMagicComments } = JSON.parse(fingerprint) as DiceQuery;
			const addons = [];
			if(noReconstruction) {
				addons.push('no reconstruction');
			}
			if(noMagicComments) {
				addons.push('no magic comments');
			}
			result.push(`   ╰ Dice from {${from.join(', ')}} to {${to.join(', ')}} ${addons.join(', ')}`);
			const rec = obj.reconstruct;
			if(rec !== undefined) {
				const code = Array.isArray(rec.code) ? rec.code : [rec.code];
				result.push('     ╰ Code (newline as <code>&#92;n</code>): <code>' + code.flatMap(c => c.split('\n')).join('\\n') + '</code>');
			} else {
				result.push(`     ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...obj.slice.result])}}`);
			}
		}
		return true;
	},
	fromLine:  diceQueryLineParser,
	completer: diceQueryCompleter,
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
