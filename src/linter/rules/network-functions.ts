import { LintingRuleCertainty, type LintingRule } from '../linter-format';
import type { FunctionsMetadata, FunctionsResult } from './function-finder-util';
import { functionFinderUtil } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import type { MergeableRecord } from '../../util/objects';

export interface NetworkFunctionsConfig extends MergeableRecord {
    /** The list of function names that should be marked in the given context if their arguments match. */
    fns:                      readonly string[]
    /** only trigger if the function's read argument is linked to a value that matches this pattern */
    onlyTriggerWithArgument?: RegExp | string
}

export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns),
	processSearchResult: (e, c, d) => functionFinderUtil.processSearchResult(e, c, d,
		es =>
			es.filter(e => functionFinderUtil.requireArgumentValue(
				e,
				ReadFunctions,
				d,
				c.onlyTriggerWithArgument
			))
	),
	prettyPrint: functionFinderUtil.prettyPrint('network operations'),
	info:        {
		name:          'Network Functions',
		tags:          [LintingRuleTag.Reproducibility, LintingRuleTag.Security, LintingRuleTag.Performance, LintingRuleTag.Smell],
		// ensures all network functions found are actually network functions through its limited config, but doesn't find all network functions since the config is pre-crawled, and the DFG may be over-approximated
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks network functions that execute network operations, such as downloading files or making HTTP requests.',
		defaultConfig: {
			fns:                     ['read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'readRDS', 'download.file', 'url', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'content', 'handle', 'get_callback','VERB', 'fread', 'gzcon'],
			onlyTriggerWithArgument: /^(https?|ftps?|file):\/\//
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, NetworkFunctionsConfig>;
