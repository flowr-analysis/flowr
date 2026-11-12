import { type BasicQueryData, singleCriterionLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { queryHeader } from '../../query-print';
import type { QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { criteriaQueryCompleter } from '../../../cli/repl/parser/slice-query-parser';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';

/**
 * Execute a provenance query collection, {@link Dataflow.provenance}
 */
export async function executeProvenanceQuery({ analyzer }: BasicQueryData, queries: readonly ProvenanceQuery[]): Promise<ProvenanceQueryResult> {
	const start = Date.now();
	const results: ProvenanceQueryResult['results'] = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();
	for(const query of queries) {
		const key = query.criterion;
		if(results[key]) {
			log.warn(`Duplicate key for provenance query: ${key}, skipping...`);
		}
		const criterionId = SlicingCriterion.tryParse(key, nast.idMap) ?? key;

		const provenanceNode = nast.idMap.get(criterionId);
		const fdef = RFunctionDefinition.wrappingFunctionDefinition(provenanceNode, nast.idMap);
		results[key] = Array.from(Dataflow.provenance(
			criterionId,
			df.graph,
			fdef ? RNode.collectAllIds(fdef) : undefined
		));
	}
	return {
		...metaSince(start),
		results
	};
}

/** Calculates the provenance starting from a given criterion */
export interface ProvenanceQuery extends BaseQueryFormat {
	readonly type:          'provenance';
	/** The slicing criterion to use as a start*/
	readonly criterion:     SlicingCriterion,
	/** Whether to stop on fdef boundaries */
	readonly restrictFdef?: boolean;
}

export interface ProvenanceQueryResult extends BaseQueryResult {
	/**
	 * Maps the requested criteria to the returned ids
	 */
	results: Record<string, NodeId[]>
}
/**
 * Checks whether the given argument represents a fdef boundary with an `f` suffix.
 */
export function fdefBoundaryParser(argument: string): boolean {
	const endBracket = argument.indexOf(')');
	return argument[endBracket + 1] === 'f';
}

export const ProvenanceQueryDefinition = {
	title:           'Provenance Query',
	executor:        executeProvenanceQuery,
	perQueryResults: true,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'provenance'>['provenance'];
		const df = await analyzer.dataflow();
		result.push(queryHeader('provenance', formatter, out['.meta'].timing));
		for(const [key, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Provenance for ${key}`);
			const dfg = Dataflow.reduceGraph(df.graph, new Set(obj));
			result.push(`     ╰ [Mermaid Url](${Dataflow.visualize.mermaid.url(dfg)})`);
		}
		return true;
	},
	fromLine:  singleCriterionLineParser('provenance', 'provenance', line => ({ restrictFdef: fdefBoundaryParser(line[0]) })),
	completer: criteriaQueryCompleter,
	syntax:    '@provenance (<criterion>)[f] <code | file://path>',
	schema:    Joi.object({
		type:         Joi.string().valid('provenance').required().description('The type of the query.'),
		criterion:    Joi.string().required().description('The slicing criterion to use.'),
		restrictFdef: Joi.boolean().required().description('Whether to stop on fdef boundaries.')
	}).description('Provenance query definition'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'provenance'>['provenance'];
		for(const obj of Object.values(out.results)) {
			flattened.push(...obj);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'provenance'>;
