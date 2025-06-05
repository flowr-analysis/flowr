import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeControlFlowQuery } from './control-flow-query-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import { CfgVertexType } from '../../../control-flow/control-flow-graph';
import { cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import type { CfgSimplificationPassName } from '../../../control-flow/cfg-simplification';
import { CfgSimplificationPasses } from '../../../control-flow/cfg-simplification';

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
	executor:        executeControlFlowQuery,
	asciiSummarizer: (formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'control-flow'>['control-flow'];
		result.push(`Query: ${bold('control-flow', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push(`   ╰ CFG: ${cfgToMermaidUrl(out.controlFlow, processed.normalize)}`);
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
		return [...out.controlFlow.graph.vertices(true)]
			.filter(([,v]) => v.type !== CfgVertexType.Block)
			.map(v => v[0]);
	}
} as const satisfies SupportedQuery<'control-flow'>;
