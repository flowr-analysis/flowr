import type { BasicQueryData } from '../../base-query-format';
import type { LinterQuery, LinterQueryResult } from './linter-query-format';
import { type LintingRuleNames, LintingRules } from '../../../linter/linter-rules';
import { log } from '../../../util/log';
import type { ConfiguredLintingRule } from '../../../linter/linter-format';
import { executeLintingRule } from '../../../linter/linter-executor';
import { GasFeatureKey, GasLevel, GasWikiRef } from '../../../gas';
import { formatLints } from '../../../linter/linter-output';
import { flowrVersion } from '../../../util/version';
import { isNotUndefined } from '../../../util/assert';

/**
 * Executes the given linter queries using the provided analyzer.
 * A query without an explicit rule list runs only the rules that are active by default.
 * @see {@link executeLintingRule}
 * @see {@link LinterRuleInformation#activeByDefault} - opts a rule out of the default rule set
 */
export async function executeLinterQuery({ analyzer }: BasicQueryData, queries: readonly LinterQuery[]): Promise<LinterQueryResult> {
	// no explicit rules: run only the rules that opt in via activeByDefault (default true)
	const defaultRules = (Object.keys(LintingRules) as LintingRuleNames[])
		.filter((name: LintingRuleNames) => (LintingRules[name].info as { activeByDefault?: boolean }).activeByDefault !== false);
	const flattened = queries.flatMap(q => q.rules ?? defaultRules);
	const distinct = new Set(flattened);
	if(distinct.size !== flattened.length) {
		const pretty = [...distinct].filter(r => flattened.indexOf(r) !== flattened.lastIndexOf(r)).map(r => typeof r === 'string' ? r : r.name).join(', ');
		log.warn(`Linter query collection contains duplicate rules ${pretty}, only linting for each rule once`);
	}

	// typed loosely to avoid a too-complex mapped-union at the indexed writes below; cast back on return
	const results: { results: Record<string, unknown> } = { results: {} };

	const start = Date.now();

	const gas = analyzer.inspectContext().gas;
	for(const entry of distinct) {
		const ruleName = typeof entry === 'string' ? entry : entry.name;
		if(gas.checkGas(GasFeatureKey.Linter) >= GasLevel.Critical) {
			log.warn(`Skipping linting rule ${ruleName} due to resource pressure (gas: critical). See ${GasWikiRef}`);
			results.results[ruleName] = { error: new Error(`skipped due to resource pressure (gas: critical), see ${GasWikiRef}`) };
			continue;
		}
		results.results[ruleName] = await executeLintingRule<typeof ruleName>(ruleName, analyzer, (entry as ConfiguredLintingRule)?.config);
	}

	/* rendered here, not when printing, so an api client gets it too */
	const format = queries.map(q => q.format).find(isNotUndefined);
	const formatted = format ? formatLints((results as LinterQueryResult).results, format, flowrVersion().toString()) : undefined;
	return {
		...results,
		...(formatted ? { formatted } : {}),
		'.meta': {
			timing: Date.now() - start
		}
	} as LinterQueryResult;
}
