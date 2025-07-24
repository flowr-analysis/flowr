import { LintingCertainty, LintingPrettyPrintContext, type LintingResult, type LintingRule } from '../linter-format';
import type { SourceRange } from '../../util/range';
import { rangeIsSubsetOf } from '../../util/range';

import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';

export interface DeadCodeResult extends LintingResult {
	range: SourceRange
}

export interface DeadCodeConfig extends MergeableRecord {
	analyzeDeadCode: boolean
}

export const DEAD_CODE = {
	createSearch:        (config) => Q.all().with(Enrichment.CfgInformation, { analyzeDeadCode: config.analyzeDeadCode }),
	processSearchResult: (elements, _config, _data) => {
		return {
			results: combineRanges(
				elements.getElements()
					.filter(element => {
						const cfgInformation = enrichmentContent(element, Enrichment.CfgInformation);
						return !cfgInformation.isReachable;
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
		[LintingPrettyPrintContext.Query]: result => `Code at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${formatRange(result.range)} will never be executed`,
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
