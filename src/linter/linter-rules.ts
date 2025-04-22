import { R1_DEPRECATED_FUNCTIONS } from './rules/1-deprecated-functions';
import type { LintingRule } from './linter-format';

export const LintingRules = {
	'deprecated-functions': R1_DEPRECATED_FUNCTIONS
} as const;

export type LintingRuleNames = keyof typeof LintingRules

export type LintingRuleResult<Name extends LintingRuleNames> = typeof LintingRules[Name] extends LintingRule<infer Result, infer _Config, infer _Info, infer _Elements> ? Result : never
export type LintingRuleConfig<Name extends LintingRuleNames> = typeof LintingRules[Name] extends LintingRule<infer _Result, infer Config, infer _Info, infer _Elements> ? Config : never
