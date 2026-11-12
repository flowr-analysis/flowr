import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type ControlFlowInformation, CfgVertex } from '../../../control-flow/control-flow-graph';
import { cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import { type CfgSimplificationPassName, CfgSimplificationPasses } from '../../../control-flow/cfg-simplification';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';

/**
 * Executes the control flow query with the given simplification passes.
 */
export async function executeControlFlowQuery({ analyzer }: BasicQueryData, queries: readonly ControlFlowQuery[]): Promise<ControlFlowQueryResult> {
	if(queries.length !== 1) {
		log.warn('The control flow query expects only up to one query, but got', queries.length);
	}

	const query = queries[0];

	const start = Date.now();
	const controlFlow = await analyzer.controlflow(query.config?.simplificationPasses);
	return {
		...metaSince(start),
		controlFlow
	};
}

/**
 * Provides the control flow graph with an optional, fixed configuration
 */
export interface ControlFlowQuery extends BaseQueryFormat {
	readonly type:    'control-flow';
	readonly config?: {
		/**
		 * If set, the control flow graph will be simplified using the given passes.
		 * Defaults to the default simplification order.
		 */
		simplificationPasses?: readonly CfgSimplificationPassName[];
	}
}

export interface ControlFlowQueryResult extends BaseQueryResult {
	readonly controlFlow: ControlFlowInformation;
}

export const ControlFlowQueryDefinition = {
	title:           'Control-Flow Query',
	executor:        executeControlFlowQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'control-flow'>['control-flow'];
		result.push(`Query: ${bold('control-flow', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push(`   ╰ CFG: ${cfgToMermaidUrl(out.controlFlow, await analyzer.normalize())}`);
		return true;
	},
	schema: Joi.object({
		type:   Joi.string().valid('control-flow').required().description('The type of the query.'),
		config: Joi.object({
			simplificationPasses: Joi.array().items(
				Joi.string().valid(...Object.keys(CfgSimplificationPasses) as CfgSimplificationPassName[])
			).description('The simplification passes to apply to the control flow graph. If unset, the default simplification order will be used.')
		}).optional().description('Optional configuration for the control flow query.')
	}).description('The control flow query provides the control flow graph of the analysis, optionally simplified.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'control-flow'>['control-flow'];
		return out.controlFlow.graph.vertices(true).entries()
			.filter(([,v]) => !CfgVertex.isBlock(v))
			.map(v => v[0])
			.toArray();
	}
} as const satisfies SupportedQuery<'control-flow'>;
