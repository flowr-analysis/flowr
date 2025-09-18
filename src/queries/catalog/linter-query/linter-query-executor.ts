import type { BasicQueryData } from '../../base-query-format';
import type { LinterQuery, LinterQueryResult } from './linter-query-format';
import type { LintingRuleNames } from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';
import { log } from '../../../util/log';
import type { ConfiguredLintingRule } from '../../../linter/linter-format';
import { executeLintingRule } from '../../../linter/linter-executor';

export function executeLinterQuery({ parse, ast, dataflow, config }: BasicQueryData, queries: readonly LinterQuery[]): LinterQueryResult {
	const flattened = queries.flatMap(q => q.rules ?? (Object.keys(LintingRules) as LintingRuleNames[]));
	const distinct = new Set(flattened);
	if(distinct.size !== flattened.length) {
		const pretty = [...distinct].filter(r => flattened.indexOf(r) !== flattened.lastIndexOf(r)).map(r => typeof r === 'string' ? r : r.name).join(', ');
		log.warn(`Linter query collection contains duplicate rules ${pretty}, only linting for each rule once`);
	}

	const results: Omit<LinterQueryResult, '.meta'> = { results: {} };

	const start = Date.now();

	const input = { parse, normalize: ast, dataflow, config };
	for(const entry of distinct) {
		const ruleName = typeof entry === 'string' ? entry : entry.name;
		results.results[ruleName] = executeLintingRule<typeof ruleName>(ruleName, input, (entry as ConfiguredLintingRule)?.config);	
	}

	return {
		...results,
		'.meta': {
			timing: Date.now() - start
		}
	};
}
