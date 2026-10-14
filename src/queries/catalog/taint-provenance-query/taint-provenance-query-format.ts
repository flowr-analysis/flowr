import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeTaintProvenanceQuery } from './taint-provenance-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { DataflowGraphTaintAnalysisProvenance } from '../../../taint-analysis/provenance/dataflow-graph-taint-analysis-provenance';
import { formatTaintValue, taintExplanationToLines } from '../../../taint-analysis/provenance/taint-provenance-explanation';
import type { TaintInferenceResult } from '../../../taint-analysis/builder/taint-analysis';
import { Bottom, BottomSymbol } from '../../../abstract-interpretation/domains/lattice';
import type { AnyPredefinedTaintAnalysisName } from '../../../taint-analysis/predefined/predefined';
import { taintQueryCompleter, taintQueryLineParser } from '../taint-query/taint-query-format';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';

export interface TaintProvenanceQuery extends BaseQueryFormat {
	readonly type:  'taint-provenance';
	readonly defs?: AnyPredefinedTaintAnalysisName[];
}

export interface TaintProvenanceQueryResult extends BaseQueryResult {
	readonly provenance: DataflowGraphTaintAnalysisProvenance;
	readonly taint:      Map<string, TaintInferenceResult>;
}

function taintProvenanceQueryLineParser(output: ReplOutput, line: readonly string[], config: FlowrConfig): ParsedQueryLine<'taint-provenance'> {
	const { query, rCode } = taintQueryLineParser(output, line, config);
	const defs = (Array.isArray(query) ? query : [query]).flatMap(q => q?.defs ?? []);
	return { query: [{ type: 'taint-provenance', defs }], rCode };
}

export const TaintProvenanceQueryDefinition = {
	title:           'Taint Provenance Query',
	executor:        executeTaintProvenanceQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, resultStrings) => {
		const out = queryResults as QueryResults<'taint-provenance'>['taint-provenance'];
		const idMap = (await analyzer.normalize()).idMap;
		resultStrings.push(`Query: ${bold('taint-provenance', formatter)} (${printAsMs(out['.meta'].timing, 0)})`,
			`   ╰ [Taint Provenance](${DataflowGraphTaintAnalysisProvenance.visualize.mermaid.url(out.provenance)})`);
		for(const [name, { domains, findings, msg }] of out.taint) {
			resultStrings.push(`   ╰ **${name}**:`);
			for(const finding of findings) {
				resultStrings.push(`      ╰ finding at ${finding.nodeId}: ${finding.msg ?? msg ?? ''}`);
				const explanation = DataflowGraphTaintAnalysisProvenance.explain(out.provenance, finding.nodeId, name);
				resultStrings.push(...taintExplanationToLines(out.provenance, explanation).map(line => `          ${line}`));
			}
			if(domains.value === Bottom) {
				resultStrings.push(`      ╰ state: ${BottomSymbol}`);
				continue;
			}
			for(const [id, value] of domains.value) {
				const formatted = value === undefined ? undefined : formatTaintValue(value);
				if(formatted !== undefined) {
					resultStrings.push(`      ╰ ${id} (${idMap.get(id)?.lexeme ?? '?'}): ${formatted}`);
				}
			}
		}
		return true;
	},
	fromLine:  taintProvenanceQueryLineParser,
	completer: taintQueryCompleter,
	schema:    Joi.object({
		type: Joi.string().valid('taint-provenance').required().description('The type of the query.'),
		defs: Joi.array().description('The taint analyses to run.')
	}).description('The taint-provenance query returns a view on the dataflow graph explaining the provenance of taint analysis results'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'taint-provenance'>;
