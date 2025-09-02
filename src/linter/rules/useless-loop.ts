import { loopyFunctions, onlyLoopsOnce } from '../../control-flow/useless-loop';
import type { BuiltInMappingName } from '../../dataflow/environments/built-in';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import type { MergeableRecord } from '../../util/objects';
import type { SourceRange } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

export interface UselessLoopResult extends LintingResult {
    name:  string,
    range: SourceRange
}

export interface UselessLoopConfig extends MergeableRecord {
    /** Function origins that are considered loops */
    loopyFunctions: Set<BuiltInMappingName>
}

export interface UselessLoopMetadata extends MergeableRecord {
    numOfUselessLoops: number
}

export const USELESS_LOOP = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: (elements, useLessLoopConfig, { config, dataflow, normalize, cfg }) => {
		const results = elements.getElements().filter(e => {
			const vertex = dataflow.graph.getVertex(e.node.info.id);
			return vertex
				&& isFunctionCallVertex(vertex)
				&& vertex.origin !== 'unnamed'
				&& useLessLoopConfig.loopyFunctions.has(vertex.origin[0] as BuiltInMappingName);
		}).filter(loop =>
			onlyLoopsOnce(loop.node.info.id, dataflow.graph, cfg, normalize, config)
		).map(res => ({
			certainty: LintingResultCertainty.Certain,
			name:      res.node.lexeme as string,
			range:     res.node.info.fullRange as SourceRange
		} satisfies UselessLoopResult));

		return {
			results: results,
			'.meta': {
				numOfUselessLoops: results.length
			}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.name}-loop at ${formatRange(result.range)} only loops once`,
		[LintingPrettyPrintContext.Full]:  result => `${result.name}-loop at ${formatRange(result.range)} only loops once`
	},
	info: {
		name:          'Useless Loops',
		description:   'Detect loops which only iterate once',
		certainty:     LintingRuleCertainty.BestEffort,  
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Readability],
		defaultConfig: { 
			loopyFunctions: loopyFunctions
		}
	}
} as const satisfies LintingRule<UselessLoopResult, UselessLoopMetadata, UselessLoopConfig>;