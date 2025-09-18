import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import { LintingRules } from './linter-rules';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { LintingResults, LintingRule } from './linter-format';
import { runSearch } from '../search/flowr-search-executor';
import type { DeepPartial } from 'ts-essentials';
import { deepMergeObject } from '../util/objects';
import type { FlowrConfigOptions } from '../config';
import type { KnownParserType, ParseStepOutput } from '../r-bridge/parser';

export function executeLintingRule<Name extends LintingRuleNames>(ruleName: Name, input: { parse: ParseStepOutput<KnownParserType>, normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions }, lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>>): LintingResults<Name> {
	try {
		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const fullConfig = deepMergeObject<LintingRuleConfig<Name>>(rule.info.defaultConfig, lintingRuleConfig);

		const ruleSearch = rule.createSearch(fullConfig, input);

		const searchStart = Date.now();
		const searchResult = runSearch(ruleSearch, input);
		const searchTime = Date.now() - searchStart;

		const processStart = Date.now();
		const result = rule.processSearchResult(searchResult, fullConfig, input);
		const processTime = Date.now() - processStart;
		return {
			...result,
			'.meta': {
				...result['.meta'],
				searchTimeMs:  searchTime,
				processTimeMs: processTime
			}
		};
	} catch(e) {
		const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : JSON.stringify(e);
		return {
			error: msg
		};
	}
}
