import { loopyFunctions, onlyLoopsOnce } from '../../control-flow/useless-loop';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { at } from '../linter-util';
import { type LintingResult, type LintingRule, prettyPrint, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import type { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';

export interface UselessLoopResult extends LintingResult {
	name: string
}

export interface UselessLoopConfig extends MergeableRecord {
	/** Function origins that are considered loops */
	loopyFunctions: Set<BuiltInProcName>
}

export interface UselessLoopMetadata extends MergeableRecord {
	numOfUselessLoops: number
}

export const USELESS_LOOP = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, useLessLoopConfig, data) => {
		const normalize = await data.normalize();
		const dataflow = await data.dataflow();
		const cfg = await data.controlflow();
		const results = elements.getElements().filter(e => {
			const vertex = dataflow.graph.getVertex(e.node.info.id);
			return vertex
				&& DfgVertex.isFunctionCall(vertex)
				&& vertex.origin !== 'unnamed'
				&& useLessLoopConfig.loopyFunctions.has(vertex.origin[0]);
		}).filter(loop =>
			onlyLoopsOnce(loop.node.info.id, dataflow.graph, cfg, normalize, data.inspectContext())
		).map(res => ({
			...at(res.node),
			name: res.node.lexeme as string
		} satisfies UselessLoopResult));

		return {
			results: results,
			'.meta': {
				numOfUselessLoops: results.length
			}
		};
	},
	prettyPrint: prettyPrint(
		result => `${result.name}-loop at ${SourceLocation.format(result.loc)} only loops once`
	),
	info: {
		name:          'Useless Loops',
		description:   'Finds loops that iterate only once.',
		certainty:     LintingRuleCertainty.BestEffort,
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability],
		defaultConfig: () => ({
			loopyFunctions: loopyFunctions
		})
	}
} as const satisfies LintingRule<UselessLoopResult, UselessLoopMetadata, UselessLoopConfig>;
