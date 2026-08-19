import Joi from 'joi';
import type { AbsintAnalysis } from '../../../abstract-interpretation/absint-inference';
import { DataFrameShapeAnalysis } from '../../../abstract-interpretation/data-frame/shape-inference';
import { AbstractDomain } from '../../../abstract-interpretation/domains/abstract-domain';
import { BottomSymbol, TopSymbol } from '../../../abstract-interpretation/domains/lattice';
import type { MultiValueDomain, MultiValueStateDomain } from '../../../abstract-interpretation/domains/multi-value-state-domain';
import type { AbstractProduct } from '../../../abstract-interpretation/domains/partial-product-domain';
import type { StateDomain } from '../../../abstract-interpretation/domains/state-domain';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/core';
import { lastCriterionFragment, queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import type { FlowrConfig } from '../../../config';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { fileProtocol } from '../../../r-bridge/retriever';
import { SlicingCriterion, type SlicingCriteria } from '../../../slicing/criterion/parse';
import { isNotUndefined } from '../../../util/assert';
import { Record } from '../../../util/record';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeAbsintQuery } from './absint-query-executor';

export interface AbsintQuery<AbsintType extends AbsintQueryType = AbsintQueryType> extends BaseQueryFormat {
	readonly type:      'absint';
	readonly inference: AbsintType;
	readonly criteria?: SlicingCriteria;
}

export interface AbsintQueryResult<AbsintType extends AbsintQueryType = AbsintQueryType> extends BaseQueryResult {
	result: AbsintQueryStateDomain<AbsintType> | Map<SlicingCriterion, AbsintQueryDomain<AbsintType> | undefined>
}

/**
 * An abstract interpretation analysis supported by the abstract interpretation query,
 * consisting of a factory creating the analysis and the name of the abstract domain of the analysis to return the inferred values for.
 */
interface AbsintQueryInference<Domains extends AbstractProduct = AbstractProduct> {
	/** Creates the abstract interpretation analysis to perform */
	readonly create:  () => AbsintAnalysis<Domains>;
	/** The name of the abstract domain of the analysis to return the inferred abstract values for */
	readonly domain?: keyof Domains & string;
}

export const AbsintQueryInferences = {
	'df-shape': { create: () => new DataFrameShapeAnalysis({ trackOperations: false }), domain: 'dataFrame' }
} as const satisfies Record<string, AbsintQueryInference>;

export type AbsintQueryType = keyof typeof AbsintQueryInferences;

/** The abstract domains of the analysis performed by an abstract interpretation query */
export type AbsintQueryDomains<AbsintType extends AbsintQueryType = AbsintQueryType> =
	ReturnType<typeof AbsintQueryInferences[AbsintType]['create']> extends AbsintAnalysis<infer Domains> ? Domains : never;

export type AbsintQueryStateDomain<AbsintType extends AbsintQueryType = AbsintQueryType> =
	typeof AbsintQueryInferences[AbsintType] extends { domain: string } ? StateDomain<AbsintQueryDomains<AbsintType>[typeof AbsintQueryInferences[AbsintType]['domain']]> : MultiValueStateDomain<Partial<AbsintQueryDomains<AbsintType>>>;

export type AbsintQueryDomain<AbsintType extends AbsintQueryType = AbsintQueryType> =
	typeof AbsintQueryInferences[AbsintType] extends { domain: string } ? AbsintQueryDomains<AbsintType>[typeof AbsintQueryInferences[AbsintType]['domain']] : MultiValueDomain<Partial<AbsintQueryDomains<AbsintType>>>;


function absintQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	if(line.length === 0 || (line.length === 1 && !startingNewArg)) {
		return { completions: Record.keys(AbsintQueryInferences).map(type => `${type} `) };
	} else if((line.length === 1 && startingNewArg) || (line.length === 2 && line[1].length === 0)) {
		return { completions: ['(', '""', fileProtocol] };
	} else if(line.length === 2 && !startingNewArg && line[1].startsWith('(') && !line[1].endsWith(')') && !line[1].endsWith(';')) {
		const criteria = sliceCriteriaParser(line[1] + ')');

		if(criteria !== undefined && criteria.length > 0 && criteria.every(SlicingCriterion.isValid)) {
			return { completions: [';', ') '], argumentPart: '' };
		}
		const fragment = lastCriterionFragment(line[1]);

		if(/^\d+$/.test(fragment)) {
			return { completions: [`${fragment}@`, `${fragment}:`, `${fragment}~`], argumentPart: fragment };
		}
	} else if((line.length === 2 && startingNewArg) || (line.length === 3 && line[2].length === 0)) {
		return { completions: ['""', fileProtocol] };
	} else if((line.length === 2 && fileProtocol.startsWith(line[1])) || (line.length === 3 && fileProtocol.startsWith(line[2]))) {
		return { completions: [fileProtocol] };
	}
	return { completions: [] };
}

function absintQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'absint'> {
	const type = line[0].toLowerCase();

	if(!Record.has(AbsintQueryInferences, type)) {
		output.stderr(output.formatter.format(`Invalid inference type "${type}", must be one of ${Record.keys(AbsintQueryInferences).map(type => `"${type}"`).join(', ')}`, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}
	const criteria = sliceCriteriaParser(line[1]);

	if(criteria !== undefined && !criteria.every(SlicingCriterion.isValid)) {
		output.stderr(output.formatter.format(`Invalid slicing criteria "${line[1]}"`, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}
	const code = queryLineCode(line, criteria ? 2 : 1);

	return {
		query: {
			type:      'absint',
			inference: type,
			criteria:  criteria
		},
		rCode: code
	};
}

export const AbsintQueryDefinition = {
	title:           'Abstract Interpretation Query',
	executor:        executeAbsintQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'absint'>['absint'];
		result.push(`Query: ${bold('absint', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);

		if(out.result instanceof AbstractDomain) {
			if(out.result.isBottom()) {
				result.push(`   ╰ state: ${BottomSymbol}`);
				return true;
			} else if(out.result.isTop()) {
				result.push(`   ╰ state: ${TopSymbol}`);
				return true;
			}
		}
		const entries = out.result instanceof Map ? out.result.entries().toArray() : out.result.entries();

		result.push(...entries.slice(0, 51).map(([key, domain]) => {
			const criterion = SlicingCriterion.isValid(key) ? key : SlicingCriterion.fromId(key);
			return `   ╰ ${criterion}: ${domain?.toString()}`;
		}));

		if(entries.length > 50) {
			result.push('   ╰ ... (see JSON)');
		}
		return true;
	},
	jsonFormatter: (queryResults: BaseQueryResult): object => {
		const { result, ...out } = queryResults as QueryResults<'absint'>['absint'];

		if(result instanceof AbstractDomain && result.isNotValue()) {
			return { result: result.toJSON(), ...out };
		}
		const entries = result instanceof Map ? result.entries().toArray() : result.entries();
		const json = Object.fromEntries(entries.map(([key, domain]) => [key, domain?.toJSON() ?? null]));

		return { result: json, ...out };
	},
	completer: absintQueryCompleter,
	fromLine:  absintQueryLineParser,
	syntax:    '@absint <inference> [(<crit>;...)] <code | file://path>',
	schema:    Joi.object({
		type:      Joi.string().valid('absint').required().description('The type of the query.'),
		inference: Joi.string().valid(...Record.keys(AbsintQueryInferences)).required().description('The type of abstract interpretation inference.'),
		criteria:  Joi.array().items(Joi.string()).optional().description('The slicing criteria of the nodes to get the inferred abstract values for.')
	}).description('The abstract interpretation query retrieves inferred abstract values'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'absint'>['absint'];
		const entries = out.result instanceof Map ? out.result.entries().toArray() : out.result.entries();

		return entries.filter(([, value]) => isNotUndefined(value)).map(([key]) => key);
	},
} as const satisfies SupportedQuery<'absint'>;
