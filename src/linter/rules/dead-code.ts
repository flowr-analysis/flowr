import { LintingCertainty, LintingPrettyPrintContext, type LintingResult, type LintingRule } from '../linter-format';
import type { SourceRange } from '../../util/range';
import { rangeIsSubsetOf } from '../../util/range';

import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { visitCfgInOrder } from '../../control-flow/simple-visitor';
import { extractSimpleCfg } from '../../control-flow/extract-cfg';
import { cfgAnalyzeDeadCode } from '../../control-flow/cfg-dead-code';

export interface DeadCodeResult extends LintingResult {
	range: SourceRange
}

export interface DeadCodeConfig extends MergeableRecord {
	analyzeDeadCode: boolean
}

export const DEAD_CODE = {
	createSearch:        (_config) => Q.all(),
	processSearchResult: (elements, config, data) => {
		let cfg = extractSimpleCfg(data.normalize);
		if(config.analyzeDeadCode) {
			cfg = cfgAnalyzeDeadCode(cfg, { ast: data.normalize, dfg: data.dataflow.graph, config: data.config });
		}
		const reachable = new Set<NodeId>();
		visitCfgInOrder(cfg.graph, cfg.entryPoints, node => {
			reachable.add(node);
		});
		return {
			results: combineRanges(
				elements.getElements()
					.filter(element => {
						const id = element.node.info.id;
						return !reachable.has(id);
					})
					.map(element => element.node.info.fullRange as SourceRange))
				.map(range => ({
					certainty: LintingCertainty.Definitely,
					range
				})),
			'.meta': undefined as never
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Full]:  result => `at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Query]: result => `at ${formatRange(result.range)}`,
	},
	info: {
		name:          'Dead Code',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Marks areas of code that are never reached or whose invocation has no effect.',
		defaultConfig: {
			analyzeDeadCode: true
		}
	}
} as const satisfies LintingRule<DeadCodeResult, never, DeadCodeConfig>;

function combineRanges(ranges: SourceRange[]): SourceRange[] {
	const unique = [...new Set<SourceRange>(ranges)];
	return unique.filter(range => !unique.some(other => range !== other && rangeIsSubsetOf(range, other)));
}
