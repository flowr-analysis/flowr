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
import { Bottom, BottomSymbol } from '../../../abstract-interpretation/domains/lattice';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { CommandCompletions } from '../../../cli/repl/core';
import { fileProtocol } from '../../../r-bridge/retriever';
import type { TaintInferenceResult } from '../../../taint-analysis/builder/taint-analysis';
import { DataflowGraphTaintAnalysisProvenance, TaintProvenanceMode } from '../../../taint-analysis/provenance/dataflow-graph-taint-analysis-provenance';
import { taintExplanationToLines } from '../../../taint-analysis/provenance/taint-provenance-explanation';
import { queryLineCode } from '../../../cli/repl/parser/slice-query-parser';




export interface TaintQuery extends BaseQueryFormat {
	readonly type:        'taint';
	readonly defs:        AnyPredefinedTaintAnalysisName[]
	readonly provenance?: TaintProvenanceMode
}

export interface TaintQueryResult<Analyses extends string[]> extends BaseQueryResult {
	readonly results:     Map<Analyses[number], TaintInferenceResult>,
	readonly provenance?: { readonly mode: TaintProvenanceMode, readonly graph: DataflowGraphTaintAnalysisProvenance }
}

const prefix = 'definitions:';
const provenancePrefix = 'provenance:';

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
	let provenance: TaintProvenanceMode | undefined = undefined;
	let at = 0;
	for(; at < line.length; at++) {
		if(line[at].startsWith(prefix)) {
			const defsPart = line[at].slice(prefix.length).split(',');
			const parseResult = defsInInput(defsPart);
			if(parseResult.invalid.length > 0) {
				output.stderr(`Unknown taint definition names: ${parseResult.invalid.map(r => bold(r, output.formatter)).join(', ')}`
					+ `\nKnown taint definitions are: ${Object.keys(predefinedTaintAnalyses).map(r => bold(r, output.formatter)).join(', ')}`);
			}
			defs = parseResult.valid;
		} else if(line[at].startsWith(provenancePrefix)) {
			const mode = line[at].slice(provenancePrefix.length);
			const modes = Object.values(TaintProvenanceMode) as string[];
			if(modes.includes(mode)) {
				provenance = mode as TaintProvenanceMode;
			} else {
				output.stderr(`Unknown provenance mode: ${bold(mode, output.formatter)}\nKnown provenance modes are: ${modes.map(m => bold(m, output.formatter)).join(', ')}`);
			}
		} else {
			break;
		}
	}
	return { query: [{ type: 'taint', defs, ...(provenance === undefined ? {} : { provenance }) }], rCode: queryLineCode(line, at) };
}

export const TaintQueryDefinition = {
	title:           'Taint Analysis Query',
	executor:        executeTaintQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, resultStrings) => {
		const out = queryResults as QueryResults<'taint'>['taint'];
		const state = out.results.entries().toArray();
		resultStrings.push(`Query: ${bold('taint', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.provenance?.mode === TaintProvenanceMode.Graph) {
			resultStrings.push(`   ╰ [Taint Provenance](${DataflowGraphTaintAnalysisProvenance.visualize.mermaid.url(out.provenance.graph)})`);
		}

		for(const [name, result] of state) {
			resultStrings.push(`   ╰ **${name}**:`);
			const lift = result.domains.value;

			if(result.findings.length > 0) {
				if(result.msg !== undefined) {
					resultStrings.push(`      ╰ ${result.msg}:`);
				}
				for(const finding of result.findings) {
					resultStrings.push(`          ╰ ${finding.msg !== undefined ? `${finding.msg} ` : ''}`);
					if(out.provenance !== undefined && out.provenance.mode !== TaintProvenanceMode.None) {
						const explanation = DataflowGraphTaintAnalysisProvenance.explain(out.provenance.graph, finding.nodeId, name);
						resultStrings.push(...taintExplanationToLines(out.provenance.graph, explanation).map(line => `              ${line}`));
					}
				}
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
	jsonFormatter: (queryResults: BaseQueryResult) => {
		const { results, provenance: _provenance, ...out } = queryResults as QueryResults<'taint'>['taint'];
		const json = new Map(
			Array.from(results, ([name, { domains, msg, findings }]) => [name, {
				domains: domains.value === Bottom ? domains.value.description : Object.fromEntries(domains.value.entries().map(([key, domain]) => [key, domain?.toJSON() ?? null])),
				msg,
				findings,
			}])
		);
		const result = { results: json, ...out } as object;
		return result;
	},
	completer: taintQueryCompleter,
	fromLine:  taintQueryLineParser,
	schema:    Joi.object({
		type:       Joi.string().valid('taint').required().description('The type of the query.'),
		defs:       Joi.array().description('The taint analyses to run.'),
		provenance: Joi.string().valid(...Object.values(TaintProvenanceMode)).optional().description('Whether to explain the findings (explain) and additionally provide the provenance graph (graph).')
	}).description('The taint query conducts taint analyses and returns their results.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'taint'>;

