import { type LintingRuleConfig, type LintingRuleMetadata, type LintingRuleNames, type LintingRuleResult, LintingRules } from './linter-rules';
import type { LintingResults, LintingRule } from './linter-format';
import { runSearch } from '../search/flowr-search-executor';
import type { DeepPartial } from 'ts-essentials';
import { deepMergeObject } from '../util/objects';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { SecureMode } from '../util/secure-mode';

/**
 * Rule options that are compiled to regular expressions. As a crafted regex can take exponential time to match (ReDoS),
 * the {@link SecureMode} ignores them in a given rule config, keeping the rule's defaults. Add every new option of this kind.
 */
const RegexRuleOptions: { readonly [N in LintingRuleNames]?: readonly (keyof LintingRuleConfig<N>)[] } = {
	'absolute-file-paths':   ['absolutePathRegex'],
	'problematic-inputs':    ['consider', 'pipeCommandFunctions'],
	'no-leaked-credentials': ['credentialNamePattern', 'credentialValuePattern']
};

/** The given rule config without the {@link RegexRuleOptions} if the secure mode is enabled. */
function withoutUntrustedRegexes<Name extends LintingRuleNames>(ruleName: Name, config: DeepPartial<LintingRuleConfig<Name>> | undefined): DeepPartial<LintingRuleConfig<Name>> | undefined {
	const keys = RegexRuleOptions[ruleName] as readonly string[] | undefined;
	if(!config || !keys || !SecureMode.isEnabled()) {
		return config;
	}
	return Object.fromEntries(Object.entries(config).filter(([k]) => !keys.includes(k))) as DeepPartial<LintingRuleConfig<Name>>;
}

/**
 * Executes a specific linting rule on the given analysis provider input.
 */
export async function executeLintingRule<Name extends LintingRuleNames>(ruleName: Name, input: ReadonlyFlowrAnalysisProvider, lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>>): Promise<LintingResults<Name>> {
	try {
		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const fullConfig = deepMergeObject<LintingRuleConfig<Name>>(rule.info.defaultConfig(input.inspectContext()), withoutUntrustedRegexes(ruleName, lintingRuleConfig));

		const ruleSearch = rule.createSearch(fullConfig, input);

		const searchStart = Date.now();
		const searchResult = await runSearch(ruleSearch, input);
		const searchTime = Date.now() - searchStart;

		const processStart = Date.now();
		const result = await rule.processSearchResult(searchResult, fullConfig, input);
		const processTime = Date.now() - processStart;

		return {
			...result,
			'.meta': {
				...(result['.meta'] as LintingRuleMetadata<Name> ?? {}),
				searchTimeMs:  searchTime,
				processTimeMs: processTime
			}
		};
	} catch(e) {
		return {
			error: e
		};
	}
}
