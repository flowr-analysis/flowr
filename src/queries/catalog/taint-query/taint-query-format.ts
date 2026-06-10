import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import { executeTaintQuery } from './taint-query-executor';
import type {
	AnyPredefinedTaintAnalysisName
} from '../../../taint-analysis/predefined/predefined';
import { predefinedTaintAnalyses } from '../../../taint-analysis/predefined/predefined';
import type { AnyAbstractDomain } from '../../../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol } from '../../../abstract-interpretation/domains/lattice';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { CommandCompletions } from '../../../cli/repl/core';
import { fileProtocol } from '../../../r-bridge/retriever';
import type { StateDomainLift } from '../../../abstract-interpretation/domains/state-abstract-domain';
import type { TaintInferenceResult } from '../../../taint-analysis/builder/taint-analysis';
import type {
	TaintAnalysisDefinition } from '../../../taint-analysis/builder/taint-analysis-definition';



export interface TaintQuery extends BaseQueryFormat {
	readonly type: 'taint';
	readonly defs: AnyPredefinedTaintAnalysisName[]
}

export interface TaintQueryResult<Analyses extends string[]> extends BaseQueryResult {
	readonly results: Map<Analyses[number], TaintInferenceResult<TaintAnalysisDefinition<Analyses[number]>>>
}

const prefix = 'definitions:';

function taintQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	const prefixNotPresent = line.length == 0 || (line.length == 1 && line[0].length < prefix.length);
	const notFinished = line.length == 1 && line[0].startsWith(prefix) && !startingNewArg;
	const endOfOptions = line.length == 1 && startingNewArg || line.length == 2;

	if(prefixNotPresent) {
		return { completions: [`${prefix}`] };
	} else if(endOfOptions) {
		return { completions: [fileProtocol] };
	} else if(notFinished) {
		const withoutPrefix = line[0].slice(prefix.length);
		const used = withoutPrefix.split(',').map(r => r.trim());
		const all = Object.keys(predefinedTaintAnalyses);
		const unused = all.filter(r => !used.includes(r));
		const last = used[used.length - 1];
		const lastUnfinished = !all.includes(last);

		if(lastUnfinished) {
			// Return all strings that have not been added yet
			return { completions: unused, argumentPart: last };
		} else if(unused.length > 0) {
			// Add a comma, if the current last string is complete
			return { completions: [','], argumentPart: '' };
		} else {
			// All strings are used, complete with a space
			return { completions: [' '], argumentPart: '' };
		}
	}
	return { completions: [] };
}

function defsInInput(defsPart: readonly string[]): { valid: AnyPredefinedTaintAnalysisName[], invalid: string[] } {
	return defsPart
		.reduce((acc, name) => {
			name = name.trim();
			if(name in predefinedTaintAnalyses) {
				acc.valid.push(name as AnyPredefinedTaintAnalysisName);
			} else {
				acc.invalid.push(name);
			}
			return acc;
		}, { valid: [] as (AnyPredefinedTaintAnalysisName)[], invalid: [] as string[] });
}

function taintQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'taint'> {
	let defs: AnyPredefinedTaintAnalysisName[] = [];
	let input: string | undefined = undefined;
	if(line.length > 0 && line[0].startsWith(prefix)) {
		const defsPart = line[0].slice(prefix.length).split(',');
		const parseResult = defsInInput(defsPart);
		if(parseResult.invalid.length > 0) {
			output.stderr(`Unknown taint definition names: ${parseResult.invalid.map(r => bold(r, output.formatter)).join(', ')}`
				+`\nKnown taint definitions are: ${Object.keys(predefinedTaintAnalyses).map(r => bold(r, output.formatter)).join(', ')}`);
		}
		defs = parseResult.valid;
		input = line[1];
	} else if(line.length > 0) {
		input = line[0];
	}
	return { query: [{ type: 'taint', defs: defs }], rCode: input } ;
}

export const TaintQueryDefinition = {
	executor:        executeTaintQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, resultStrings) => {
		const out = queryResults as QueryResults<'taint'>['taint'];
		const state = out.results.entries().toArray();
		resultStrings.push(`Query: ${bold('taint', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);

		for(const [name, result] of state) {
			resultStrings.push(`   ╰ **${name}**:`);
			const lift = result.visitor.getEndState().value as StateDomainLift<AnyAbstractDomain>;

			if(result.finding) {
				resultStrings.push(`      ╰ finding: ${result.finding}`);
			}

			if(lift === Bottom) {
				resultStrings.push(`      ╰ state: ${BottomSymbol}`);
				return true;
			}

			resultStrings.push(...lift.entries().take(20)
				.map(([key, domain]) => `      ╰ ${key}: ${domain?.toString()}`));

			if(resultStrings.length > 20) {
				resultStrings.push('      ╰ ... (see JSON)');
			}
		}

		return true;
	},
	completer: taintQueryCompleter,
	fromLine:  taintQueryLineParser,
	schema:    Joi.object({
		type: Joi.string().valid('taint').required().description('The type of the query.'),
		defs: Joi.array().description('The taint analyses to run.')
	}).description('The taint query conducts taint analyses and returns their results.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'taint'>;

