import { LintingCertainty, LintingPrettyPrintContext, type LintingResult, type LintingRule } from '../linter-format';
import type { SourceRange } from '../../util/range';
import { combineRanges } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import { type CfgSimplificationPassName, DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';

export interface DeadCodeResult extends LintingResult {
	range: SourceRange
}

export interface DeadCodeConfig extends MergeableRecord {
	/**
	 * The simplification passes that should be run on the extracted CFG.
	 * Defaults to the entries of {@link DefaultCfgSimplificationOrder} and `analyze-dead-code`.
	 */
	simplificationPasses?: CfgSimplificationPassName[]
}

export interface DeadCodeMetadata extends MergeableRecord {
	consideredNodes: number
}

export const DEAD_CODE = {
	createSearch: (config) => Q.all().with(Enrichment.CfgInformation, {
		checkReachable:       true,
		simplificationPasses: config.simplificationPasses ?? [...DefaultCfgSimplificationOrder, 'analyze-dead-code']
	}),
	processSearchResult: (elements, _config, _data) => {
		const meta: DeadCodeMetadata = {
			consideredNodes: 0
		};
		return {
			results: combineRanges(
				...new Set<SourceRange>(elements.getElements()
					.filter(element => {
						meta.consideredNodes++;
						const cfgInformation = enrichmentContent(element, Enrichment.CfgInformation);
						return !cfgInformation.isReachable;
					})
					.map(element => element.node.info.fullRange ?? element.node.location)
					.filter(isNotUndefined)))
				.map(range => ({
					certainty: LintingCertainty.Definitely,
					range
				})),
			'.meta': meta
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Code at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${formatRange(result.range)} can never be executed`,
	},
	info: {
		name:          'Dead Code',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Marks areas of code that are never reached during execution.',
		defaultConfig: {
			analyzeDeadCode: true
		}
	}
} as const satisfies LintingRule<DeadCodeResult, DeadCodeMetadata, DeadCodeConfig>;
