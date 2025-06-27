import { type LintingResult , LintingCertainty, type LintingRule } from '../linter-format';
import type { SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';

export interface DeadCodeResult extends LintingResult {
	range: SourceRange
}

export interface DeadCodeConfig extends MergeableRecord {
}

export interface DeadCodeMetadata extends MergeableRecord {
}

export const DEAD_CODE = {
	createSearch:        (_config) => Q.all(),
	processSearchResult: (elements, _config, _data) => {
		const metadata: DeadCodeMetadata = { yes: true };
		return {
			results: elements.getElements().flatMap(element => ({
				certainty: LintingCertainty.Definitely,
				range:     element.node.info.fullRange as SourceRange
			})),
			'.meta': metadata
		};
	},
	prettyPrint: result => `at ${formatRange(result.range)}`,
	info:        {
		name:          'Dead Code',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Marks areas of code that are never reached or whose invocation has no effect.',
		defaultConfig: {}
	}
} as const satisfies LintingRule<DeadCodeResult, DeadCodeMetadata, DeadCodeConfig>;
