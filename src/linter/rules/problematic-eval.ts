import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';

/**
 * TODO: provide provenance proof, also check something like `stopifnot(not(x, contains(y))` etc.
 */
export interface ProblematicEvalResult extends LintingResult {
	loc: SourceLocation
}

export interface ProblematicEvalConfig extends MergeableRecord {
	// TODO: provide proof etc.
	/**
	 * All calls that should be considered to be valid eval entry points, this will be interpreted as a Regex!
	 */
	considerAsEval: string
}

// TODO:
export type ProblematicEvalMetadata = MergeableRecord;

// TODO: doc
export const PROBLEMATIC_EVAL = {
	/* this can be done better once we have types */
	createSearch: config => Q.fromQuery({
		type:          'call-context',
		callName:      config.considerAsEval,
		callNameExact: false
	}),
	processSearchResult: (elements, _config, _data): { results: ProblematicEvalResult[], '.meta': ProblematicEvalMetadata } => {
		const metadata: ProblematicEvalMetadata = {
			totalConsidered: 0
		};
		console.log(elements);
		return {
			results: [],
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Use of eval-like function at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Use of eval-like function at ${SourceLocation.format(result.loc)} is potentially problematic`
	},
	info: {
		name:          'Unused Definitions',
		description:   'Checks for unused definitions.',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Readability],
		// our limited analysis causes unused definitions involving complex reflection etc. not to be included in our result, but unused definitions are correctly validated
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			considerAsEval: '^eval$'
		}
	}
} as const satisfies LintingRule<ProblematicEvalResult, ProblematicEvalMetadata, ProblematicEvalConfig>;
