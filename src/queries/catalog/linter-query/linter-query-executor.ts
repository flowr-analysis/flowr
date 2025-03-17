import type { BasicQueryData } from '../../base-query-format';
import type { LinterQuery, LinterQueryResult } from './linter-query-format';
import { runSearch } from '../../../search/flowr-search-executor';
import { FlowrSearchElements } from '../../../search/flowr-search';
import type { LintingRuleNames, LintingRuleResult } from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';


export function executeLinterQuery({ ast, dataflow }: BasicQueryData, queries: readonly LinterQuery[]): LinterQueryResult {
	const rules = new Set(queries.flatMap(q => q.rules ?? (Object.keys(LintingRules) as LintingRuleNames[])));
	const results: { [L in LintingRuleNames]?: LintingRuleResult<L>[] } = {};

	const start = Date.now();

	for(const ruleName of rules) {
		const rule = LintingRules[ruleName];
		const config = rule.defaultConfig;
		const ruleSearch = rule.createSearch(config);
		const searchResult = runSearch(ruleSearch, { normalize: ast, dataflow });
		results[ruleName] = rule.processSearchResult(new FlowrSearchElements(searchResult), config);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
