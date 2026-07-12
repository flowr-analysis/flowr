import Joi from 'joi';
import type { AbsintVisitorConfiguration, AbstractInterpretationVisitor, DomainOfVisitor } from '../../../abstract-interpretation/absint-visitor';
import { DataFrameShapeInferenceVisitor } from '../../../abstract-interpretation/data-frame/shape-inference';
import { AbstractDomain, type AnyAbstractDomain } from '../../../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol, TopSymbol } from '../../../abstract-interpretation/domains/lattice';
import type { StateAbstractDomain } from '../../../abstract-interpretation/domains/state-abstract-domain';
import type { ValueDomain } from '../../../abstract-interpretation/domains/state-domain-like';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/core';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import type { FlowrConfig } from '../../../config';
import { fileProtocol } from '../../../r-bridge/retriever';
import { SlicingCriterion, type SlicingCriteria } from '../../../slicing/criterion/parse';
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

export const AbsintQueryInferences = {
	'df-shape': config => new DataFrameShapeInferenceVisitor(config)
} satisfies Record<string, (config: AbsintVisitorConfiguration) => AbstractInterpretationVisitor<StateAbstractDomain<AnyAbstractDomain>>>;

export type AbsintQueryType = keyof typeof AbsintQueryInferences;

export type AbsintQueryStateDomain<AbsintType extends AbsintQueryType = AbsintQueryType> = DomainOfVisitor<ReturnType<typeof AbsintQueryInferences[AbsintType]>>;

export type AbsintQueryDomain<AbsintType extends AbsintQueryType = AbsintQueryType> = ValueDomain<AbsintQueryStateDomain<AbsintType>>;


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
	} else if((line.length === 2 && startingNewArg) || (line.length === 3 && line[2].length === 0)) {
		return { completions: ['""', fileProtocol] };
	} else if((line.length === 2 && fileProtocol.startsWith(line[1])) || (line.length === 3 && fileProtocol.startsWith(line[2]))) {
		return { completions: [fileProtocol] };
	}
	return { completions: [] };
}

function absintQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'absint'> {
	const type = line[0].toLowerCase();

	if(!Object.hasOwn(AbsintQueryInferences, type)) {
		output.stderr(output.formatter.format(`Invalid inference type "${type}", must be one of ${Record.keys(AbsintQueryInferences).map(type => `"${type}"`).join(', ')}`, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}
	const criteria = sliceCriteriaParser(line[1]);

	if(criteria !== undefined && !criteria.every(SlicingCriterion.isValid)) {
		output.stderr(output.formatter.format(`Invalid slicing criteria "${line[1]}"`, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}
	const code = criteria ? line[2] : line[1];

	return {
		query: {
			type:      'absint',
			inference: type as AbsintQueryType,
			criteria:  criteria
		},
		rCode: code
	};
}

export const AbsintQueryDefinition = {
	executor:        executeAbsintQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'absint'>['absint'];
		const domains = out.result instanceof AbstractDomain ? out.result.value : out.result;
		result.push(`Query: ${bold('absint', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);

		if(domains === Bottom) {
			result.push(`   ╰ state: ${BottomSymbol}`);
			return true;
		} else if(out.result instanceof AbstractDomain && out.result.isTop()) {
			result.push(`   ╰ state: ${TopSymbol}`);
			return true;
		}
		result.push(...domains.entries().take(20).map(([key, domain]) => {
			const criterion = SlicingCriterion.isValid(key) ? key : SlicingCriterion.fromId(key);
			return `   ╰ ${criterion}: ${domain?.toString()}`;
		}));

		if(domains.size > 20) {
			result.push('   ╰ ... (see JSON)');
		}
		return true;
	},
	jsonFormatter: (queryResults: BaseQueryResult) => {
		const { result: domains, ...out } = queryResults as QueryResults<'absint'>['absint'];
		const state = domains instanceof AbstractDomain ? domains.value : domains;
		const json = state === Bottom ? state.description : Object.fromEntries(state.entries().map(([key, domain]) => [key, domain?.toJSON() ?? null]));
		const result = { domains: json, ...out } as object;

		return result;
	},
	completer: absintQueryCompleter,
	fromLine:  absintQueryLineParser,
	schema:    Joi.object({
		type:      Joi.string().valid('absint').required().description('The type of the query.'),
		inference: Joi.string().valid(...Record.keys(AbsintQueryInferences)).required().description('The type of abstract interpretation inference.'),
		criteria:  Joi.array().items(Joi.string()).optional().description('The slicing criteria of the nodes to get the inferred abstract values for.')
	}).description('The abstract interpretation query retrieves inferred abstract values'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'absint'>;
