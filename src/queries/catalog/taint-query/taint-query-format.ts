import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import {
	type AnyPredefinedTaintAnalysisName,
	type AllPredefinedTaintAnalysisNames,
	predefinedTaintAnalyses
} from '../../../taint-analysis/predefined/predefined';
import { Bottom, BottomSymbol } from '../../../abstract-interpretation/domains/lattice';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { type CommandCompletions, completePrefixedList } from '../../../cli/repl/completion';
import type { TaintInferenceResult } from '../../../taint-analysis/builder/taint-analysis';
import { log } from '../../../util/log';
import { queryLineCode } from '../../../cli/repl/parser/slice-query-parser';
import { TaintProvenanceGraph } from '../../../taint-analysis/provenance/taint-provenance-graph';

/** Executes the given taint queries using the provided analyzer. */
export async function executeTaintQuery({ analyzer }: BasicQueryData, queries: readonly TaintQuery[]): Promise<TaintQueryResult<AllPredefinedTaintAnalysisNames>> {
	const flattened = queries.flatMap(q => q.defs);
	const start = Date.now();

	if(flattened.length === 0) {
		log.warn('Missing taint query definition');
		return { results: new Map(), '.meta': { timing: Date.now() - start } };
	}

	const analysis = analyzer
		.taint<AllPredefinedTaintAnalysisNames>()
		.addPredefined(...flattened);

	if(queries.some(q => q.recordProvenance)) {
		analysis.withProvenance();
	}

	return { results: await analysis.run(), '.meta': { timing: Date.now() - start } };
}

export interface TaintQuery extends BaseQueryFormat {
	readonly type:              'taint';
	readonly defs:              AnyPredefinedTaintAnalysisName[]
	readonly recordProvenance?: boolean
}

export interface TaintQueryResult<Analyses extends string[]> extends BaseQueryResult {
	readonly results: Map<Analyses[number], TaintInferenceResult>,
}

const prefix = 'definitions:';
const provenancePrefix = 'provenance:';

function taintQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	return completePrefixedList(line, startingNewArg, prefix, Object.keys(predefinedTaintAnalyses));
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
	let recordProvenance: boolean | undefined = undefined;
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
			if(mode === 'on' || mode === 'off') {
				recordProvenance = mode === 'on';
			} else {
				output.stderr(`Unknown provenance setting: ${bold(mode, output.formatter)}, use ${bold('on', output.formatter)} or ${bold('off', output.formatter)}`);
			}
		} else {
			break;
		}
	}
	return { query: [{ type: 'taint', defs, ...(recordProvenance === undefined ? {} : { recordProvenance }) }], rCode: queryLineCode(line, at) };
}

export const TaintQueryDefinition = {
	title:           'Taint Analysis Query',
	executor:        executeTaintQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, resultStrings) => {
		const out = queryResults as QueryResults<'taint'>['taint'];
		const state = out.results.entries().toArray();
		resultStrings.push(`Query: ${bold('taint', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);

		for(const [name, result] of state) {
			resultStrings.push(`   ╰ **${name}**:`);
			const lift = result.domains.value;

			if(result.findings.length > 0) {
				if(result.msg !== undefined) {
					resultStrings.push(`      ╰ ${result.msg}:`);
				}
				for(const finding of result.findings) {
					const [first, ...reasons] = (finding.msg ?? '').split('\n');
					resultStrings.push(`          ╰ ${first} `, ...reasons.map(reason => `              ${reason}`));
					if(result.provenance !== undefined) {
						const provenanceGraph = TaintProvenanceGraph.hidePassthrough(TaintProvenanceGraph.ofFinding(result.provenance.graph, finding.nodeId), [finding.nodeId]);
						resultStrings.push(`                  ╰ Provenance-Graph: ${TaintProvenanceGraph.toMermaidUrl(provenanceGraph, name)}`);
					}
				}
			} else if(result.provenance !== undefined && result.provenance.graph.rootIds().size > 0) {
				const provenanceGraph = TaintProvenanceGraph.hidePassthrough(result.provenance.graph);
				resultStrings.push(`      ╰ Provenance: ${TaintProvenanceGraph.toMermaidUrl(provenanceGraph, name)}`);
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
		const { results, ...out } = queryResults as QueryResults<'taint'>['taint'];
		const json = new Map(
			Array.from(results, ([name, { domains, msg, findings, provenance }]) => [name, {
				domains: domains.value === Bottom ? domains.value.description : Object.fromEntries(domains.value.entries().map(([key, domain]) => [key, domain?.toJSON() ?? null])),
				msg,
				findings,
				...provenance === undefined ? {} : { provenance: TaintProvenanceGraph.toJson(provenance.graph) }
			}])
		);
		const result = { results: json, ...out } as object;
		return result;
	},
	completer: taintQueryCompleter,
	fromLine:  taintQueryLineParser,
	schema:    Joi.object({
		type:             Joi.string().valid('taint').required().description('The type of the query.'),
		defs:             Joi.array().description('The taint analyses to run.'),
		recordProvenance: Joi.boolean().optional().description('Whether to record where the taints of the findings originate from.')
	}).description('The taint query conducts taint analyses and returns their results.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'taint'>;

