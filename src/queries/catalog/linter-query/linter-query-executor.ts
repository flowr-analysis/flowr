import type { BasicQueryData } from '../../base-query-format';
import type { LinterQuery, LinterQueryResult } from './linter-query-format';
import { runSearch } from '../../../search/flowr-search-executor';
import { FlowrSearchElements } from '../../../search/flowr-search';
import type { LintingRuleNames, LintingRuleResult } from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';
import { log } from '../../../util/log';


export function executeLinterQuery({ ast, dataflow }: BasicQueryData, queries: readonly LinterQuery[]): LinterQueryResult {
	const flattened = queries.flatMap(q => q.rules ?? (Object.keys(LintingRules) as LintingRuleNames[]));
	const distinct = new Set(flattened);
	if(distinct.size !== flattened.length) {
		log.warn(`Linter query collection contains duplicate rules ${[...distinct].filter(r => flattened.indexOf(r) !== flattened.lastIndexOf(r)).join(', ')}, only linting for each rule once`);
	}

	const results: { [L in LintingRuleNames]?: LintingRuleResult<L>[] } = {};

	const start = Date.now();

	for(const ruleName of distinct) {
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
