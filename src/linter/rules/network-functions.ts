import type { LintingRule } from '../linter-format';
import { LintingPrettyPrintContext  } from '../linter-format';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import type { FunctionsMetadata, FunctionsResult, FunctionsToDetectConfig } from './function-finder-util';
import { FUNCTION_FINDER_UTIL } from './function-finder-util';

export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => FUNCTION_FINDER_UTIL.createSearch(config.functionsToFind),
	processSearchResult: FUNCTION_FINDER_UTIL.processSearchResult,
	prettyPrint:         {
		[LintingPrettyPrintContext.Query]: result => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Function \`${result.function}\` called at ${formatRange(result.range)} is related to network operations`
	},
	info: {
		name:          'Network Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Marks functions that are related to network operations and should be used with caution.',
		defaultConfig: {
			functionsToFind: []
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, FunctionsToDetectConfig>;
