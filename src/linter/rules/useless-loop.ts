import { loopyFunctions, onlyLoopsOnce } from '../../control-flow/useless-loop';
import type { BuiltInProcName } from '../../dataflow/environments/built-in';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

export interface UselessLoopResult extends LintingResult {
	name: string,
	loc:  SourceLocation
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
	processSearchResult: (elements, useLessLoopConfig, { analyzer, dataflow, normalize, cfg }) => {
		const results = elements.getElements().filter(e => {
			const vertex = dataflow.graph.getVertex(e.node.info.id);
			return vertex
				&& isFunctionCallVertex(vertex)
				&& vertex.origin !== 'unnamed'
				&& useLessLoopConfig.loopyFunctions.has(vertex.origin[0]);
		}).filter(loop =>
			onlyLoopsOnce(loop.node.info.id, dataflow.graph, cfg, normalize, analyzer.inspectContext())
		).map(res => ({
			certainty:  LintingResultCertainty.Certain,
			name:       res.node.lexeme as string,
			loc:        SourceLocation.fromNode(res.node) ?? SourceLocation.invalid(),
			involvedId: res.node.info.id
		} satisfies UselessLoopResult));

		return {
			results: results,
			'.meta': {
				numOfUselessLoops: results.length
			}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.name}-loop at ${SourceLocation.format(result.loc)} only loops once`,
		[LintingPrettyPrintContext.Full]:  result => `${result.name}-loop at ${SourceLocation.format(result.loc)} only loops once`
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